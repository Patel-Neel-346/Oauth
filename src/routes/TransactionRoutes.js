// src/routes/transactionRoutes.js
import express from "express";
// import {
//   depositFunds,
//   withdrawFunds,
//   transferFunds,
//   transferByAccountNumber,
//   getAccountBalance,
//   getTransactionHistory,
//   processInterestPayment,
//   getTransactionDetails,
//   getAllUserTransactions,
//   cancelTransaction,
//   reverseTransaction,
//   getTransactionStatistics,
// } from "../controller/TransactionController.js";
import { Authenticated } from "../middleware/authMiddleware.js";
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

// Validation rules for transfer by account number
const transferByAccountNumberValidation = [
  body("fromAccountId")
    .isMongoId()
    .withMessage("Invalid from account ID format"),
  body("toAccountNumber")
    .isLength({ min: 8, max: 20 })
    .withMessage("Account number must be between 8 and 20 characters"),
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

// Query validation for transaction history
const transactionHistoryValidation = [
  param("accountId").isMongoId().withMessage("Invalid account ID format"),
  query("type")
    .optional()
    .isIn(["deposit", "withdrawal", "transfer", "payment", "fee", "interest"])
    .withMessage("Invalid transaction type"),
  query("status")
    .optional()
    .isIn(["pending", "completed", "failed", "cancelled"])
    .withMessage("Invalid transaction status"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format for dateFrom"),
  query("dateTo")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format for dateTo"),
  query("amountMin")
    .optional()
    .isNumeric()
    .withMessage("Amount minimum must be a number"),
  query("amountMax")
    .optional()
    .isNumeric()
    .withMessage("Amount maximum must be a number"),
];

//(only user,lender,borrower)
TransactionRouter.post(
  "/deposit",
  Authenticated,
  // depositValidation,
  // handleValidationErrors,
  // depositFunds

  DepositFunds
);

//(only user,lender,borrower)
TransactionRouter.post(
  "/withdraw",
  Authenticated,
  // withdrawalValidation,
  // handleValidationErrors,
  // withdrawFunds
  WithDrawFunds
);

//(same as above)
TransactionRouter.post(
  "/transfer",
  Authenticated,
  // transferValidation,
  // handleValidationErrors,
  // transferFunds
  TransferFunds
);

//(SAME AS ABOVE)
TransactionRouter.get(
  "/getTransactionHistroy/:accountNumber",
  Authenticated,
  // transactionHistoryValidation,
  // handleValidationErrors,
  // getTransactionHistory
  GetTransactionHistory
);

TransactionRouter.get(
  "/getTransactionSummaryForUser",
  Authenticated,
  TransactionSummary
);

export default TransactionRouter;
