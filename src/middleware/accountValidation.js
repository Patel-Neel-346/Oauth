// src/middleware/accountValidation.js
import { body, param, query, validationResult } from "express-validator";
import { ApiError } from "../helpers/ApiError.js";

// Helper function to handle validation results
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg);
    throw new ApiError(400, "Validation failed", errorMessages);
  }
  next();
};

// ========== ACCOUNT MANAGEMENT VALIDATIONS ==========

export const createAccountValidation = [
  body("accountType")
    .isIn(["savings", "checking", "loan", "credit", "investment"])
    .withMessage("Invalid account type"),

  body("initialDeposit")
    .optional()
    .isNumeric()
    .withMessage("Initial deposit must be a number")
    .isFloat({ min: 0 })
    .withMessage("Initial deposit must be non-negative")
    .custom((value, { req }) => {
      const { accountType } = req.body;
      const minimumDeposits = {
        savings: 100,
        checking: 50,
        loan: 0,
        credit: 0,
        investment: 1000,
      };

      if (value < minimumDeposits[accountType]) {
        throw new Error(
          `Minimum initial deposit for ${accountType} account is ${minimumDeposits[accountType]}`
        );
      }
      return true;
    }),

  body("currency")
    .optional()
    .trim()
    .isLength({ min: 1, max: 3 })
    .withMessage("Currency must be 1-3 characters")
    .matches(/^[₹$€£¥]+$/)
    .withMessage("Invalid currency symbol"),

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
    .withMessage("Currency must be 1-3 characters")
    .matches(/^[₹$€£¥]+$/)
    .withMessage("Invalid currency symbol"),

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

// ========== ACCOUNT NUMBER VALIDATIONS ==========

export const validateAccountNumber = [
  param("accountNumber")
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

  body("accountNumber")
    .optional()
    .trim()
    .matches(/^ACC\d{8}$/)
    .withMessage(
      "Invalid account number format (should be ACC followed by 8 digits)"
    ),

  handleValidationErrors,
];
