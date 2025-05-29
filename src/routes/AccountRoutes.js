import express from "express";
import {
  CreateAccount,
  getAllAccount,
  getUserAccount,
  UpdateUserAccount,
  CloseUserAccount,
} from "../controller/AccountController.js";
import { Authenticated } from "../middleware/authMiddleware.js";
import {
  hasRole,
  checkAccountOwnership,
  accountRoleChecks,
  ROLE_TYPES,
} from "../middleware/roleMiddleware.js";
import { body, param, query, validationResult } from "express-validator";
import { ApiError } from "../helpers/ApiError.js";

const AccountRoute = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return next(new ApiError(400, "Validation failed", errors.array()));
  }
  next();
};

// Validation rules for account creation
const createAccountValidation = [
  body("accountType")
    .isIn(["savings", "checking", "loan", "credit", "investment"])
    .withMessage(
      "Invalid account type. Must be one of: savings, checking, loan, credit, investment"
    ),
  body("initialDeposit")
    .optional()
    .isNumeric()
    .withMessage("Initial deposit must be a number")
    .isFloat({ min: 0 })
    .withMessage("Initial deposit cannot be negative"),
  body("currency")
    .optional()
    .isLength({ min: 1, max: 5 })
    .withMessage("Currency must be 1-5 characters"),
];

// Validation rules for account updates
const updateAccountValidation = [
  param("accountId").isMongoId().withMessage("Invalid account ID format"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "suspended"])
    .withMessage("Status must be one of: active, inactive, suspended"),
  body("interestRate")
    .optional()
    .isNumeric()
    .withMessage("Interest rate must be a number")
    .isFloat({ min: 0, max: 100 })
    .withMessage("Interest rate must be between 0 and 100"),
];

// Validation rules for account closure
const closeAccountValidation = [
  param("accountId").isMongoId().withMessage("Invalid account ID format"),
  body("transferAccountId")
    .optional()
    .isMongoId()
    .withMessage("Invalid transfer account ID format"),
  body("reason")
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage("Reason must be between 1 and 500 characters"),
];

// Query validation for getting accounts
const getAccountsValidation = [
  query("status")
    .optional()
    .isIn(["active", "inactive", "suspended", "closed"])
    .withMessage("Invalid status filter"),
  query("accountType")
    .optional()
    .isIn(["savings", "checking", "loan", "credit", "investment"])
    .withMessage("Invalid account type filter"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Create account - All authenticated users can create accounts
AccountRoute.post(
  "/",
  Authenticated,
  accountRoleChecks.canCreateAccount,
  createAccountValidation,
  handleValidationErrors,
  CreateAccount
);

// Get all accounts - Admins and managers can see all, others see only their own
AccountRoute.get(
  "/",
  Authenticated,
  accountRoleChecks.canViewAccount,
  getAccountsValidation,
  handleValidationErrors,
  getAllAccount
);

// Get specific account - Users can view their own accounts, admins can view any
AccountRoute.get(
  "/:accountId",
  Authenticated,
  accountRoleChecks.canViewAccount,
  param("accountId").isMongoId().withMessage("Invalid account ID format"),
  handleValidationErrors,
  checkAccountOwnership(),
  getUserAccount
);

// Update account - Users can update their own accounts, admins can update any
AccountRoute.put(
  "/:accountId",
  Authenticated,
  accountRoleChecks.canUpdateAccount,
  updateAccountValidation,
  handleValidationErrors,
  checkAccountOwnership(),
  UpdateUserAccount
);

// Close account - Users can close their own accounts, admins can close any
AccountRoute.post(
  "/:accountId/close",
  Authenticated,
  accountRoleChecks.canCloseAccount,
  closeAccountValidation,
  handleValidationErrors,
  checkAccountOwnership(),
  CloseUserAccount
);

// Get account types - Available to all authenticated users
AccountRoute.get(
  "/types",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
  ]),
  async (req, res, next) => {
    try {
      const userId = req.user;
      const userRoles = req.userRoles; // Set by role middleware

      const accountTypes = [
        {
          type: "savings",
          description: "Standard savings account with interest",
          minDeposit: 100,
          interestRate: 3.5,
          requirements: ["Available to all users"],
          available: true,
        },
        {
          type: "checking",
          description: "Checking account for daily transactions",
          minDeposit: 50,
          interestRate: 1.0,
          requirements: ["Available to all users"],
          available: true,
        },
        {
          type: "loan",
          description: "Loan account for borrowing funds",
          minDeposit: 0,
          interestRate: 8.5,
          requirements: ["Must have BORROWER role"],
          available: userRoles.includes(ROLE_TYPES.BORROWER),
        },
        {
          type: "credit",
          description: "Credit account with revolving credit line",
          minDeposit: 0,
          interestRate: 18.0,
          requirements: ["Must have BORROWER or LENDER role"],
          available:
            userRoles.includes(ROLE_TYPES.BORROWER) ||
            userRoles.includes(ROLE_TYPES.LENDER),
        },
        {
          type: "investment",
          description: "Investment account for portfolio management",
          minDeposit: 1000,
          interestRate: 5.0,
          requirements: ["Must have LENDER role or ADMIN role"],
          available:
            userRoles.includes(ROLE_TYPES.LENDER) ||
            userRoles.includes(ROLE_TYPES.ADMIN),
        },
      ];

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          availableTypes: accountTypes.filter((type) => type.available),
          allTypes: accountTypes,
          userRoles: userRoles,
        },
        message: "Account types retrieved successfully",
      });
    } catch (error) {
      console.error("Get account types error:", error);
      return next(new ApiError(500, "Failed to retrieve account types"));
    }
  }
);

export default AccountRoute;
