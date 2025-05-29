// src/routes/TransactionRoutes.js - Updated with Role-Based Access Control
import express from "express";
import { Authenticated } from "../middleware/authMiddleware.js";
import {
  hasRole,
  checkAccountOwnership,
  transactionRoleChecks,
  ROLE_TYPES,
} from "../middleware/roleMiddleware.js";
import { body, param, query, validationResult } from "express-validator";
import { ApiError } from "../helpers/ApiError.js";
import {
  DepositFunds,
  GetTransactionHistory,
  TransactionSummary,
  TransferFunds,
  WithDrawFunds,
} from "../controller/TransactionControllerV2.js";

const TransactionRouter = express.Router();

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

// Validation rules for deposit
const depositValidation = [
  body("accountId").isMongoId().withMessage("Invalid account ID format"),
  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0"),
  body("description")
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage("Description must be between 1 and 500 characters"),
];

// Validation rules for withdrawal
const withdrawalValidation = [
  body("accountId").isMongoId().withMessage("Invalid account ID format"),
  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0"),
  body("description")
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage("Description must be between 1 and 500 characters"),
];

// Validation rules for transfer
const transferValidation = [
  body("fromAccountId")
    .isMongoId()
    .withMessage("Invalid from account ID format"),
  body("toAccountId").isMongoId().withMessage("Invalid to account ID format"),
  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0"),
  body("description")
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage("Description must be between 1 and 500 characters"),
];

// Custom middleware to check account ownership for transactions
const checkTransactionAccountOwnership = async (req, res, next) => {
  try {
    const userId = req.user;
    const { accountId, fromAccountId } = req.body;

    // Check which account ID to validate
    const accountToCheck = accountId || fromAccountId;

    if (!accountToCheck) {
      return next(new ApiError(400, "Account ID is required"));
    }

    // Import Account model
    const Account = (await import("../models/Account.js")).default;
    const account = await Account.findById(accountToCheck);

    if (!account) {
      return next(new ApiError(404, "Account not found"));
    }

    // Check if user has admin/manager role to bypass ownership check
    const userRoles = req.userRoles || [];
    const canAccessAnyAccount = userRoles.some((role) =>
      [ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER].includes(role)
    );

    if (
      !canAccessAnyAccount &&
      account.userId.toString() !== userId.toString()
    ) {
      return next(
        new ApiError(
          403,
          "Access Denied: You can only access your own accounts"
        )
      );
    }

    next();
  } catch (error) {
    console.error("Transaction account ownership check error:", error);
    return next(new ApiError(500, "Error checking account ownership"));
  }
};

// Deposit funds - Users, borrowers, and lenders can deposit to their own accounts
TransactionRouter.post(
  "/deposit",
  Authenticated,
  transactionRoleChecks.canPerformTransaction,
  depositValidation,
  handleValidationErrors,
  checkTransactionAccountOwnership,
  DepositFunds
);

// Withdraw funds - Users, borrowers, and lenders can withdraw from their own accounts
TransactionRouter.post(
  "/withdraw",
  Authenticated,
  transactionRoleChecks.canPerformTransaction,
  withdrawalValidation,
  handleValidationErrors,
  checkTransactionAccountOwnership,
  WithDrawFunds
);

// Transfer funds - Users, borrowers, and lenders can transfer from their own accounts
TransactionRouter.post(
  "/transfer",
  Authenticated,
  transactionRoleChecks.canPerformTransaction,
  transferValidation,
  handleValidationErrors,
  checkTransactionAccountOwnership,
  TransferFunds
);

// Get transaction history - Users can view their own history, admins can view any
TransactionRouter.get(
  "/getTransactionHistroy/:accountNumber",
  Authenticated,
  transactionRoleChecks.canViewOwnTransactions,
  param("accountNumber")
    .isLength({ min: 8, max: 20 })
    .withMessage("Invalid account number format"),
  handleValidationErrors,
  // Custom middleware to check account number ownership
  async (req, res, next) => {
    try {
      const userId = req.user;
      const { accountNumber } = req.params;
      const userRoles = req.userRoles || [];

      // Admin and managers can view any account's history
      const canViewAnyAccount = userRoles.some((role) =>
        [ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER].includes(role)
      );

      if (canViewAnyAccount) {
        return next();
      }

      // For regular users, check if the account belongs to them
      const Account = (await import("../models/Account.js")).default;
      const account = await Account.findOne({
        accountNumber: accountNumber,
        userId: userId,
      });

      if (!account) {
        return next(
          new ApiError(
            403,
            "Access Denied: You can only view your own transaction history"
          )
        );
      }

      next();
    } catch (error) {
      console.error("Transaction history access check error:", error);
      return next(
        new ApiError(500, "Error checking transaction history access")
      );
    }
  },
  GetTransactionHistory
);

// Get transaction summary - Users can view their own summary, admins can view any
TransactionRouter.get(
  "/getTransactionSummaryForUser",
  Authenticated,
  transactionRoleChecks.canViewOwnTransactions,
  TransactionSummary
);

// Admin-only routes for transaction management
TransactionRouter.get(
  "/admin/all-transactions",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER]),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("status")
    .optional()
    .isIn(["pending", "completed", "failed", "cancelled"])
    .withMessage("Invalid status"),
  query("type")
    .optional()
    .isIn(["deposit", "withdrawal", "transfer", "payment", "fee", "interest"])
    .withMessage("Invalid type"),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      // This would call an admin-specific controller method
      // For now, just return a success message
      res.status(200).json({
        success: true,
        message: "Admin transaction view - implement controller method",
        data: {
          userRole: req.userRoles,
          allowedActions: [
            "view_all_transactions",
            "cancel_transactions",
            "reverse_transactions",
          ],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Manager and Admin can cancel transactions
TransactionRouter.put(
  "/admin/cancel/:transactionId",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER]),
  param("transactionId")
    .isMongoId()
    .withMessage("Invalid transaction ID format"),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      // This would call a transaction cancellation controller method
      res.status(200).json({
        success: true,
        message: "Transaction cancellation - implement controller method",
        data: { transactionId: req.params.transactionId },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin-only route to reverse transactions
TransactionRouter.put(
  "/admin/reverse/:transactionId",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN]),
  param("transactionId")
    .isMongoId()
    .withMessage("Invalid transaction ID format"),
  body("reason").notEmpty().withMessage("Reason for reversal is required"),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      // This would call a transaction reversal controller method
      res.status(200).json({
        success: true,
        message: "Transaction reversal - implement controller method",
        data: {
          transactionId: req.params.transactionId,
          reason: req.body.reason,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default TransactionRouter;
