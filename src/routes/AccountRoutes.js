import express from "express";
import {
  CreateAccount,
  getAllAccount,
  getUserAccount,
  UpdateUserAccount,
  CloseUserAccount,
} from "../controller/AccountController.js";
import { Authenticated } from "../middleware/authMiddleware.js";
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

AccountRoute.post(
  "/",
  Authenticated,
  createAccountValidation,
  handleValidationErrors,
  CreateAccount
);

AccountRoute.get(
  "/",
  Authenticated,
  getAccountsValidation,
  handleValidationErrors,
  getAllAccount
);

AccountRoute.get(
  "/:accountId",
  Authenticated,
  param("accountId").isMongoId().withMessage("Invalid account ID format"),
  handleValidationErrors,
  getUserAccount
);

AccountRoute.put(
  "/:accountId",
  Authenticated,
  updateAccountValidation,
  handleValidationErrors,
  UpdateUserAccount
);

AccountRoute.post(
  "/:accountId/close",
  Authenticated,
  closeAccountValidation,
  handleValidationErrors,
  CloseUserAccount
);

AccountRoute.get("/types", Authenticated, async (req, res, next) => {
  try {
    const userId = req.user;
    const userProfile = await RoleUserService.getUserCompleteProfile(userId);

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
        type: "loan",
        description: "Loan account for borrowing funds",
        minDeposit: 0,
        interestRate: 8.5,
        requirements: ["Must have BORROWER role"],
        available: userProfile.roles.includes(ROLE_TYPES.BORROWER),
      },
      {
        type: "credit",
        description: "Credit account with revolving credit line",
        minDeposit: 0,
        interestRate: 18.0,
        requirements: ["Must have BORROWER or LENDER role"],
        available:
          userProfile.roles.includes(ROLE_TYPES.BORROWER) ||
          userProfile.roles.includes(ROLE_TYPES.LENDER),
      },
      {
        type: "investment",
        description: "Investment account for portfolio management",
        minDeposit: 1000,
        interestRate: 5.0,
        requirements: ["Must have LENDER role or ADMIN role"],
        available:
          userProfile.roles.includes(ROLE_TYPES.LENDER) ||
          userProfile.roles.includes(ROLE_TYPES.ADMIN),
      },
    ];

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: {
        availableTypes: accountTypes.filter((type) => type.available),
        allTypes: accountTypes,
        userRoles: userProfile.roles,
      },
      message: "Account types retrieved successfully",
    });
  } catch (error) {
    console.error("Get account types error:", error);
    return next(new ApiError(500, "Failed to retrieve account types"));
  }
});

export default AccountRoute;
