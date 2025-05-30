import express from "express";
import {
  CreateAccount,
  getAllAccount,
  getUserAccount,
  UpdateUserAccount,
  CloseUserAccount,
} from "../controller/AccountController.js";
import { Authenticated } from "../middleware/authMiddleware.js";
import { hasRole, ROLE_TYPES } from "../middleware/roleMiddleware.js";

const AccountRoute = express.Router();

// Create account - All authenticated users can create accounts
//{accountType,initialDeposit,currency}=req.body
AccountRoute.post(
  "/",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  CreateAccount
);

// Get all accounts - Admins and managers can see all
//{status,accountType,page,limit}=req.query
AccountRoute.get(
  "/",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER]),
  getAllAccount
);

// Get specific account - Users can view their own accounts, admins can view any
//{accountId}=req.params
AccountRoute.get(
  "/:accountId",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  getUserAccount
);

// Update account - Users can update their own accounts, admins can update any
//  const { accountId } = req.params;
//  const updates = req.body;
AccountRoute.put(
  "/:accountId",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
  ]),
  UpdateUserAccount
);

// Close account - Users can close their own accounts, admins can close any
// const { accountId } = req.params;
// const { reason, transferAccountId } = req.body;
AccountRoute.post(
  "/:accountId/close",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
  ]),
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
