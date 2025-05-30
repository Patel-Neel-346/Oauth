// src/middleware/transactionValidator.js
import { body, param, query, validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

// Helper function to handle validation results
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg);
    throw new ApiError(400, "Validation failed", errorMessages);
  }
  next();
};

// ========== BASIC TRANSACTION VALIDATIONS ==========

export const depositFundsValidation = [
  body("accountNumber")
    .trim()
    .notEmpty()
    .withMessage("Account number is required")
    .matches(/^ACC\d{8}$/)
    .withMessage(
      "Invalid account number format (should be ACC followed by 8 digits)"
    ),

  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 1 })
    .withMessage("Amount must be greater than 0")
    .isFloat({ max: 1000000 })
    .withMessage("Amount cannot exceed 1,000,000"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Description must be less than 255 characters"),

  handleValidationErrors,
];

export const withdrawFundsValidation = [
  body("accountNumber")
    .trim()
    .notEmpty()
    .withMessage("Account number is required")
    .matches(/^ACC\d{8}$/)
    .withMessage(
      "Invalid account number format (should be ACC followed by 8 digits)"
    ),

  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 1 })
    .withMessage("Amount must be greater than 0")
    .isFloat({ max: 1000000 })
    .withMessage("Amount cannot exceed 1,000,000"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Description must be less than 255 characters"),

  handleValidationErrors,
];

export const transferFundsValidation = [
  body("fromAccountNumber")
    .trim()
    .notEmpty()
    .withMessage("From account number is required")
    .matches(/^ACC\d{8}$/)
    .withMessage(
      "Invalid from account number format (should be ACC followed by 8 digits)"
    ),

  body("toAccountNumber")
    .trim()
    .notEmpty()
    .withMessage("To account number is required")
    .matches(/^ACC\d{8}$/)
    .withMessage(
      "Invalid to account number format (should be ACC followed by 8 digits)"
    )
    .custom((value, { req }) => {
      if (value === req.body.fromAccountNumber) {
        throw new Error("Cannot transfer to the same account");
      }
      return true;
    }),

  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 1 })
    .withMessage("Amount must be greater than 0")
    .isFloat({ max: 1000000 })
    .withMessage("Amount cannot exceed 1,000,000"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Description must be less than 255 characters"),

  handleValidationErrors,
];

// ========== TRANSACTION HISTORY VALIDATIONS ==========

export const getTransactionHistoryValidation = [
  param("accountNumber")
    .trim()
    .notEmpty()
    .withMessage("Account number is required")
    .matches(/^ACC\d{8}$/)
    .withMessage(
      "Invalid account number format (should be ACC followed by 8 digits)"
    ),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  handleValidationErrors,
];

export const getAccountBalanceValidation = [
  // Support for both body and query parameters
  body("accountNumber")
    .optional()
    .trim()
    .matches(/^ACC\d{8}$/)
    .withMessage(
      "Invalid account number format (should be ACC followed by 8 digits)"
    ),

  query("accountNumber")
    .optional()
    .trim()
    .matches(/^ACC\d{8}$/)
    .withMessage(
      "Invalid account number format (should be ACC followed by 8 digits)"
    ),

  param("accountNumber")
    .optional()
    .trim()
    .matches(/^ACC\d{8}$/)
    .withMessage(
      "Invalid account number format (should be ACC followed by 8 digits)"
    ),

  // Validate filter parameters
  query("type")
    .optional()
    .isIn(["deposit", "withdrawal", "transfer", "payment", "fee", "interest"])
    .withMessage("Invalid transaction type"),

  query("status")
    .optional()
    .isIn(["pending", "completed", "failed", "cancelled"])
    .withMessage("Invalid transaction status"),

  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid dateFrom format (use ISO 8601)"),

  query("dateTo")
    .optional()
    .isISO8601()
    .withMessage("Invalid dateTo format (use ISO 8601)")
    .custom((value, { req }) => {
      if (
        req.query.dateFrom &&
        new Date(value) < new Date(req.query.dateFrom)
      ) {
        throw new Error("dateTo must be after dateFrom");
      }
      return true;
    }),

  query("amountMin")
    .optional()
    .isNumeric()
    .withMessage("amountMin must be a number")
    .isFloat({ min: 0 })
    .withMessage("amountMin must be non-negative"),

  query("amountMax")
    .optional()
    .isNumeric()
    .withMessage("amountMax must be a number")
    .isFloat({ min: 0 })
    .withMessage("amountMax must be non-negative")
    .custom((value, { req }) => {
      if (
        req.query.amountMin &&
        parseFloat(value) < parseFloat(req.query.amountMin)
      ) {
        throw new Error("amountMax must be greater than amountMin");
      }
      return true;
    }),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  handleValidationErrors,
];

export const transactionSummaryValidation = [
  query("period")
    .optional()
    .isIn(["day", "week", "month", "quarter", "year"])
    .withMessage("Period must be one of: day, week, month, quarter, year"),

  query("accountId").optional().isMongoId().withMessage("Invalid account ID"),

  handleValidationErrors,
];

// ========== ACCOUNT VALIDATIONS ==========

export const createAccountValidation = [
  body("accountType")
    .isIn(["savings", "checking", "loan", "credit", "investment"])
    .withMessage("Invalid account type"),

  body("initialDeposit")
    .optional()
    .isNumeric()
    .withMessage("Initial deposit must be a number")
    .isFloat({ min: 0 })
    .withMessage("Initial deposit must be non-negative"),

  body("currency")
    .optional()
    .trim()
    .isLength({ min: 1, max: 3 })
    .withMessage("Currency must be 1-3 characters"),

  handleValidationErrors,
];

export const getAllAccountsValidation = [
  query("status")
    .optional()
    .isIn(["active", "inactive", "suspended", "closed"])
    .withMessage("Invalid account status"),

  query("accountType")
    .optional()
    .isIn(["savings", "checking", "loan", "credit", "investment"])
    .withMessage("Invalid account type"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  handleValidationErrors,
];

export const getUserAccountValidation = [
  param("accountId").isMongoId().withMessage("Invalid account ID"),

  handleValidationErrors,
];

export const updateUserAccountValidation = [
  param("accountId").isMongoId().withMessage("Invalid account ID"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "suspended", "closed"])
    .withMessage("Invalid account status"),

  body("interestRate")
    .optional()
    .isNumeric()
    .withMessage("Interest rate must be a number")
    .isFloat({ min: 0, max: 50 })
    .withMessage("Interest rate must be between 0% and 50%"),

  body("currency")
    .optional()
    .trim()
    .isLength({ min: 1, max: 3 })
    .withMessage("Currency must be 1-3 characters"),

  handleValidationErrors,
];

export const closeUserAccountValidation = [
  param("accountId").isMongoId().withMessage("Invalid account ID"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason must be less than 500 characters"),

  body("transferAccountId")
    .optional()
    .isMongoId()
    .withMessage("Invalid transfer account ID"),

  handleValidationErrors,
];
