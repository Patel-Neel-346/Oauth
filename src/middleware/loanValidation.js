// src/middleware/loanValidator.js
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

// ========== LOAN OFFER VALIDATIONS ==========

export const createLoanOfferValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 100 })
    .withMessage("Title must be less than 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be less than 500 characters"),

  body("minAmount")
    .isNumeric()
    .withMessage("Minimum amount must be a number")
    .isFloat({ min: 1000 })
    .withMessage("Minimum amount must be at least 1000"),

  body("maxAmount")
    .isNumeric()
    .withMessage("Maximum amount must be a number")
    .isFloat({ min: 1000 })
    .withMessage("Maximum amount must be at least 1000")
    .custom((value, { req }) => {
      if (value < req.body.minAmount) {
        throw new Error("Maximum amount must be greater than minimum amount");
      }
      return true;
    }),

  body("interestRate")
    .isNumeric()
    .withMessage("Interest rate must be a number")
    .isFloat({ min: 1, max: 50 })
    .withMessage("Interest rate must be between 1% and 50%"),

  body("termOptions")
    .isArray({ min: 1 })
    .withMessage("At least one term option is required")
    .custom((terms) => {
      const validTerms = terms.every(
        (term) => typeof term === "number" && term >= 1 && term <= 360
      );
      if (!validTerms) {
        throw new Error(
          "All term options must be numbers between 1 and 360 months"
        );
      }
      return true;
    }),

  body("loanPurpose")
    .isArray({ min: 1 })
    .withMessage("At least one loan purpose is required")
    .custom((purposes) => {
      const validPurposes = [
        "personal",
        "business",
        "home",
        "education",
        "vehicle",
        "other",
      ];
      const allValid = purposes.every((purpose) =>
        validPurposes.includes(purpose)
      );
      if (!allValid) {
        throw new Error("Invalid loan purpose provided");
      }
      return true;
    }),

  body("totalOffered")
    .isNumeric()
    .withMessage("Total offered amount must be a number")
    .isFloat({ min: 1000 })
    .withMessage("Total offered amount must be at least 1000"),

  body("eligibilityCriteria.minCreditScore")
    .optional()
    .isInt({ min: 300, max: 850 })
    .withMessage("Credit score must be between 300 and 850"),

  body("eligibilityCriteria.maxDebtToIncomeRatio")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Debt to income ratio must be between 0 and 1"),

  body("eligibilityCriteria.minMonthlyIncome")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum monthly income must be a positive number"),

  body("autoApproval")
    .optional()
    .isBoolean()
    .withMessage("Auto approval must be a boolean"),

  body("expiryDate")
    .optional()
    .isISO8601()
    .withMessage("Expiry date must be a valid date")
    .custom((date) => {
      if (new Date(date) <= new Date()) {
        throw new Error("Expiry date must be in the future");
      }
      return true;
    }),

  handleValidationErrors,
];

export const updateLoanOfferValidation = [
  param("offerId").isMongoId().withMessage("Invalid offer ID"),

  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Title cannot be empty")
    .isLength({ max: 100 })
    .withMessage("Title must be less than 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be less than 500 characters"),

  body("minAmount")
    .optional()
    .isNumeric()
    .withMessage("Minimum amount must be a number")
    .isFloat({ min: 1000 })
    .withMessage("Minimum amount must be at least 1000"),

  body("maxAmount")
    .optional()
    .isNumeric()
    .withMessage("Maximum amount must be a number")
    .isFloat({ min: 1000 })
    .withMessage("Maximum amount must be at least 1000"),

  body("interestRate")
    .optional()
    .isNumeric()
    .withMessage("Interest rate must be a number")
    .isFloat({ min: 1, max: 50 })
    .withMessage("Interest rate must be between 1% and 50%"),

  body("status")
    .optional()
    .isIn(["active", "paused", "closed", "expired"])
    .withMessage("Invalid status"),

  handleValidationErrors,
];

export const getLoanOffersValidation = [
  query("minAmount")
    .optional()
    .isNumeric()
    .withMessage("Minimum amount must be a number"),

  query("maxAmount")
    .optional()
    .isNumeric()
    .withMessage("Maximum amount must be a number"),

  query("maxInterestRate")
    .optional()
    .isNumeric()
    .withMessage("Maximum interest rate must be a number")
    .isFloat({ min: 0, max: 50 })
    .withMessage("Interest rate must be between 0% and 50%"),

  query("purpose")
    .optional()
    .isIn(["personal", "business", "home", "education", "vehicle", "other"])
    .withMessage("Invalid loan purpose"),

  query("term")
    .optional()
    .isInt({ min: 1, max: 360 })
    .withMessage("Term must be between 1 and 360 months"),

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

export const getLoanOfferDetailValidation = [
  param("offerId").isMongoId().withMessage("Invalid offer ID"),

  handleValidationErrors,
];

// ========== LOAN APPLICATION VALIDATIONS ==========

export const applyForLoanValidation = [
  param("offerId").isMongoId().withMessage("Invalid offer ID"),

  body("requestedAmount")
    .isNumeric()
    .withMessage("Requested amount must be a number")
    .isFloat({ min: 1000 })
    .withMessage("Requested amount must be at least 1000"),

  body("selectedTerm")
    .isInt({ min: 1, max: 360 })
    .withMessage("Selected term must be between 1 and 360 months"),

  body("purpose")
    .isIn(["personal", "business", "home", "education", "vehicle", "other"])
    .withMessage("Invalid loan purpose"),

  body("purposeDescription")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Purpose description must be less than 500 characters"),

  handleValidationErrors,
];

export const lenderReviewValidation = [
  param("applicationId").isMongoId().withMessage("Invalid application ID"),

  body("decision")
    .isIn(["approved", "rejected"])
    .withMessage("Decision must be either approved or rejected"),

  body("comments")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Comments must be less than 1000 characters"),

  handleValidationErrors,
];

export const adminApprovalValidation = [
  param("applicationId").isMongoId().withMessage("Invalid application ID"),

  body("decision")
    .isIn(["approved", "rejected"])
    .withMessage("Decision must be either approved or rejected"),

  body("comments")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Comments must be less than 1000 characters"),

  handleValidationErrors,
];

export const getApplicationsValidation = [
  query("status")
    .optional()
    .isIn(["pending", "under_review", "approved", "rejected", "expired"])
    .withMessage("Invalid status"),

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

// ========== LOAN MANAGEMENT VALIDATIONS ==========

export const disburseLoanValidation = [
  body("applicationId").isMongoId().withMessage("Invalid application ID"),

  body("borrowerAccountId")
    .isMongoId()
    .withMessage("Invalid borrower account ID"),

  handleValidationErrors,
];

export const makeLoanPaymentValidation = [
  param("loanId").isMongoId().withMessage("Invalid loan ID"),

  body("paymentAmount")
    .isNumeric()
    .withMessage("Payment amount must be a number")
    .isFloat({ min: 1 })
    .withMessage("Payment amount must be positive"),

  body("accountId").isMongoId().withMessage("Invalid account ID"),

  handleValidationErrors,
];

export const getLoanDetailsValidation = [
  param("loanId").isMongoId().withMessage("Invalid loan ID"),

  handleValidationErrors,
];

export const getUserLoansValidation = [
  query("type")
    .optional()
    .isIn(["borrowed", "lent"])
    .withMessage("Type must be either borrowed or lent"),

  query("status")
    .optional()
    .isIn(["active", "completed", "defaulted", "closed"])
    .withMessage("Invalid status"),

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

export const getLoanPaymentScheduleValidation = [
  param("loanId").isMongoId().withMessage("Invalid loan ID"),

  handleValidationErrors,
];

export const getOverdueLoansValidation = [
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

export const getLenderOffersValidation = [
  query("status")
    .optional()
    .isIn(["active", "paused", "closed", "expired"])
    .withMessage("Invalid status"),

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
