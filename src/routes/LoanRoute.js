// import express from "express";
// import {
//   CreateLoanOffer,
//   GetAllLoanOffers,
//   GetLoanOfferDetail,
//   UpdateLoanOffers,
//   GetLenderOffers,
//   ApplyForLoanController,
//   LenderReviewApplicationController,
//   AdminFinalApprovalController,
//   GetApplicationsController,
//   disburseLoan,
//   makeLoanPayment,
//   getLoanDetails,
//   getUserLoans,
//   getLoanPaymentSchedule,
//   getOverdueLoans,
//   getLoanAnalytics,
// } from "../controller/LoanControllers.js";
// import { Authenticated } from "../middleware/authMiddleware.js";

// const router = express.Router();

// // ========== LOAN OFFER ROUTES ==========

// // Create a new loan offer (Lender only)
// router.post("/offers", Authenticated, CreateLoanOffer);

// // Get all active loan offers (Public/Authenticated users)
// router.get("/offers", Authenticated, GetAllLoanOffers);

// // Get specific loan offer details
// router.get("/offers/:offerId", Authenticated, GetLoanOfferDetail);

// // Update loan offer (Lender only - own offers)
// router.put("/offers/:offerId", Authenticated, UpdateLoanOffers);

// // Get lender's own loan offers
// router.get("/my-offers", Authenticated, GetLenderOffers);

// // ========== LOAN APPLICATION ROUTES ==========

// // Apply for a specific loan offer (Borrower only)
// router.post("/offers/:offerId/apply", Authenticated, ApplyForLoanController);

// // Lender review application (Lender only)
// router.put(
//   "/applications/:applicationId/lender-review",
//   Authenticated,
//   LenderReviewApplicationController
// );

// // Admin final approval (Admin only)
// router.put(
//   "/applications/:applicationId/admin-approval",
//   Authenticated,
//   AdminFinalApprovalController
// );

// // Get applications based on user role
// router.get("/applications", Authenticated, GetApplicationsController);

// // ========== P2P LOAN MANAGEMENT ROUTES ==========

// // Disburse loan after approval (ADMIN only)
// router.post("/disburse", Authenticated, disburseLoan);

// // Make loan payment (BORROWER only)
// router.post("/loans/:loanId/payment", Authenticated, makeLoanPayment);

// // Get loan details (Borrower/Lender/Admin)
// router.get("/loans/:loanId", Authenticated, getLoanDetails);

// // Get user's loans with filters (Borrower/Lender)
// router.get("/my-loans", Authenticated, getUserLoans);

// // Get loan payment schedule (Borrower/Lender/Admin)
// router.get("/loans/:loanId/schedule", Authenticated, getLoanPaymentSchedule);

// // Get overdue loans (ADMIN only)
// router.get("/overdue", Authenticated, getOverdueLoans);

// // Get loan analytics dashboard (All roles with role-based filtering)
// router.get("/analytics", Authenticated, getLoanAnalytics);

// export default router;
// src/routes/LoanRoute.js - Updated with Role-Based Access Control
import express from "express";
import {
  CreateLoanOffer,
  GetAllLoanOffers,
  GetLoanOfferDetail,
  UpdateLoanOffers,
  GetLenderOffers,
  ApplyForLoanController,
  LenderReviewApplicationController,
  AdminFinalApprovalController,
  GetApplicationsController,
  disburseLoan,
  makeLoanPayment,
  getLoanDetails,
  getUserLoans,
  getLoanPaymentSchedule,
  getOverdueLoans,
  getLoanAnalytics,
} from "../controller/LoanControllers.js";
import { Authenticated } from "../middleware/authMiddleware.js";
import {
  hasRole,
  loanRoleChecks,
  checkResourceOwnership,
  ROLE_TYPES,
} from "../middleware/roleMiddleware.js";
import { body, param, query, validationResult } from "express-validator";
import { ApiError } from "../helpers/ApiError.js";

const router = express.Router();

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

// Validation rules for creating loan offers
const createLoanOfferValidation = [
  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 100 })
    .withMessage("Minimum loan amount is 100"),
  body("interestRate")
    .isNumeric()
    .withMessage("Interest rate must be a number")
    .isFloat({ min: 0.1, max: 50 })
    .withMessage("Interest rate must be between 0.1% and 50%"),
  body("duration")
    .isInt({ min: 1, max: 360 })
    .withMessage("Duration must be between 1 and 360 months"),
  body("description")
    .optional()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Description must be between 1 and 1000 characters"),
  body("requirements")
    .optional()
    .isArray()
    .withMessage("Requirements must be an array"),
];

// Validation rules for loan applications
const loanApplicationValidation = [
  param("offerId").isMongoId().withMessage("Invalid offer ID format"),
  body("requestedAmount")
    .isNumeric()
    .withMessage("Requested amount must be a number")
    .isFloat({ min: 1 })
    .withMessage("Requested amount must be greater than 0"),
  body("purpose")
    .notEmpty()
    .withMessage("Loan purpose is required")
    .isLength({ min: 1, max: 500 })
    .withMessage("Purpose must be between 1 and 500 characters"),
  body("monthlyIncome")
    .optional()
    .isNumeric()
    .withMessage("Monthly income must be a number"),
  body("employmentStatus")
    .optional()
    .isIn(["employed", "self-employed", "unemployed", "retired", "student"])
    .withMessage("Invalid employment status"),
];

// Validation rules for application reviews
const applicationReviewValidation = [
  param("applicationId")
    .isMongoId()
    .withMessage("Invalid application ID format"),
  body("status")
    .isIn(["approved", "rejected", "pending"])
    .withMessage("Status must be approved, rejected, or pending"),
  body("reviewNotes")
    .optional()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Review notes must be between 1 and 1000 characters"),
];

// Validation rules for loan payments
const loanPaymentValidation = [
  param("loanId").isMongoId().withMessage("Invalid loan ID format"),
  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0"),
  body("paymentMethod")
    .optional()
    .isIn(["bank_transfer", "debit_card", "credit_card", "wallet"])
    .withMessage("Invalid payment method"),
];

// Custom middleware to check loan offer ownership
const checkLoanOfferOwnership = async (req, res, next) => {
  try {
    const userId = req.user;
    const { offerId } = req.params;
    const userRoles = req.userRoles || [];

    // Admin can access any loan offer
    const canAccessAnyLoanOffer = userRoles.some((role) =>
      [ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER].includes(role)
    );

    if (canAccessAnyLoanOffer) {
      return next();
    }

    // Import LoanOffer model
    const LoanOffer = (await import("../models/LoanOffer.js")).default;
    const loanOffer = await LoanOffer.findById(offerId);

    if (!loanOffer) {
      return next(new ApiError(404, "Loan offer not found"));
    }

    // Check if the user owns this loan offer
    if (loanOffer.lenderId.toString() !== userId.toString()) {
      return next(
        new ApiError(
          403,
          "Access Denied: You can only access your own loan offers"
        )
      );
    }

    req.targetLoanOffer = loanOffer;
    next();
  } catch (error) {
    console.error("Loan offer ownership check error:", error);
    return next(new ApiError(500, "Error checking loan offer ownership"));
  }
};

// Custom middleware to check loan ownership
const checkLoanOwnership = async (req, res, next) => {
  try {
    const userId = req.user;
    const { loanId } = req.params;
    const userRoles = req.userRoles || [];

    // Admin can access any loan
    const canAccessAnyLoan = userRoles.some((role) =>
      [ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER].includes(role)
    );

    if (canAccessAnyLoan) {
      return next();
    }

    // Import Loan model
    const Loan = (await import("../models/Loan.js")).default;
    const loan = await Loan.findById(loanId);

    if (!loan) {
      return next(new ApiError(404, "Loan not found"));
    }

    // Check if user is either borrower or lender of this loan
    const isBorrower = loan.borrowerId.toString() === userId.toString();
    const isLender = loan.lenderId.toString() === userId.toString();

    if (!isBorrower && !isLender) {
      return next(
        new ApiError(
          403,
          "Access Denied: You can only access loans where you are the borrower or lender"
        )
      );
    }

    req.targetLoan = loan;
    req.isLoanBorrower = isBorrower;
    req.isLoanLender = isLender;
    next();
  } catch (error) {
    console.error("Loan ownership check error:", error);
    return next(new ApiError(500, "Error checking loan ownership"));
  }
};

// ========== LOAN OFFER ROUTES ==========

// Create a new loan offer (Lender only)
router.post(
  "/offers",
  Authenticated,
  loanRoleChecks.canCreateLoanOffer,
  createLoanOfferValidation,
  handleValidationErrors,
  CreateLoanOffer
);

// Get all active loan offers (All authenticated users can browse)
router.get(
  "/offers",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("minAmount")
    .optional()
    .isNumeric()
    .withMessage("Min amount must be a number"),
  query("maxAmount")
    .optional()
    .isNumeric()
    .withMessage("Max amount must be a number"),
  query("maxInterestRate")
    .optional()
    .isNumeric()
    .withMessage("Max interest rate must be a number"),
  handleValidationErrors,
  GetAllLoanOffers
);

// Get specific loan offer details (All authenticated users can view)
router.get(
  "/offers/:offerId",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  param("offerId").isMongoId().withMessage("Invalid offer ID format"),
  handleValidationErrors,
  GetLoanOfferDetail
);

// Update loan offer (Lender only - own offers)
router.put(
  "/offers/:offerId",
  Authenticated,
  loanRoleChecks.canCreateLoanOffer, // Same permission as creating
  param("offerId").isMongoId().withMessage("Invalid offer ID format"),
  createLoanOfferValidation, // Same validation as creation
  handleValidationErrors,
  checkLoanOfferOwnership,
  UpdateLoanOffers
);

// Get lender's own loan offers (Lender only)
router.get(
  "/my-offers",
  Authenticated,
  loanRoleChecks.canCreateLoanOffer,
  query("status")
    .optional()
    .isIn(["active", "inactive", "fulfilled", "expired"])
    .withMessage("Invalid status"),
  handleValidationErrors,
  GetLenderOffers
);

// ========== LOAN APPLICATION ROUTES ==========

// Apply for a specific loan offer (Borrower only)
router.post(
  "/offers/:offerId/apply",
  Authenticated,
  loanRoleChecks.canApplyForLoan,
  loanApplicationValidation,
  handleValidationErrors,
  ApplyForLoanController
);

// Lender review application (Lender only)
router.put(
  "/applications/:applicationId/lender-review",
  Authenticated,
  loanRoleChecks.canReviewApplication,
  applicationReviewValidation,
  handleValidationErrors,
  // Custom middleware to check if lender owns the loan offer
  async (req, res, next) => {
    try {
      const userId = req.user;
      const { applicationId } = req.params;

      const LoanApplication = (await import("../models/LoanApplication.js"))
        .default;
      const application = await LoanApplication.findById(applicationId)
        .populate("loanOfferId")
        .exec();

      if (!application) {
        return next(new ApiError(404, "Loan application not found"));
      }

      // Check if the lender owns the loan offer
      if (application.loanOfferId.lenderId.toString() !== userId.toString()) {
        return next(
          new ApiError(
            403,
            "Access Denied: You can only review applications for your own loan offers"
          )
        );
      }

      req.targetApplication = application;
      next();
    } catch (error) {
      console.error("Application review check error:", error);
      return next(new ApiError(500, "Error checking application access"));
    }
  },
  LenderReviewApplicationController
);

// Admin final approval (Admin only)
router.put(
  "/applications/:applicationId/admin-approval",
  Authenticated,
  loanRoleChecks.canGiveFinalApproval,
  applicationReviewValidation,
  handleValidationErrors,
  AdminFinalApprovalController
);

// Get applications based on user role
router.get(
  "/applications",
  Authenticated,
  hasRole([
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  query("status")
    .optional()
    .isIn(["pending", "lender_approved", "admin_approved", "rejected"])
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
  GetApplicationsController
);

// ========== P2P LOAN MANAGEMENT ROUTES ==========

// Disburse loan after approval (ADMIN only)
router.post(
  "/disburse",
  Authenticated,
  loanRoleChecks.canDisburseLoan,
  body("applicationId")
    .isMongoId()
    .withMessage("Invalid application ID format"),
  body("disbursementAccountId")
    .isMongoId()
    .withMessage("Invalid disbursement account ID format"),
  handleValidationErrors,
  disburseLoan
);

// Make loan payment (BORROWER only, own loans)
router.post(
  "/loans/:loanId/payment",
  Authenticated,
  loanRoleChecks.canMakePayment,
  loanPaymentValidation,
  handleValidationErrors,
  // Check if user is the borrower of this loan
  async (req, res, next) => {
    try {
      const userId = req.user;
      const { loanId } = req.params;

      const Loan = (await import("../models/Loan.js")).default;
      const loan = await Loan.findById(loanId);

      if (!loan) {
        return next(new ApiError(404, "Loan not found"));
      }

      if (loan.borrowerId.toString() !== userId.toString()) {
        return next(
          new ApiError(
            403,
            "Access Denied: You can only make payments for your own loans"
          )
        );
      }

      req.targetLoan = loan;
      next();
    } catch (error) {
      console.error("Loan payment check error:", error);
      return next(new ApiError(500, "Error checking loan payment access"));
    }
  },
  makeLoanPayment
);

// Get loan details (Borrower/Lender/Admin)
router.get(
  "/loans/:loanId",
  Authenticated,
  loanRoleChecks.canViewLoanDetails,
  param("loanId").isMongoId().withMessage("Invalid loan ID format"),
  handleValidationErrors,
  checkLoanOwnership,
  getLoanDetails
);

// Get user's loans with filters (Borrower/Lender)
router.get(
  "/my-loans",
  Authenticated,
  hasRole([
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  query("status")
    .optional()
    .isIn(["active", "completed", "defaulted", "cancelled"])
    .withMessage("Invalid status"),
  query("role")
    .optional()
    .isIn(["borrower", "lender"])
    .withMessage("Role must be borrower or lender"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  handleValidationErrors,
  getUserLoans
);

// Get loan payment schedule (Borrower/Lender/Admin)
router.get(
  "/loans/:loanId/schedule",
  Authenticated,
  loanRoleChecks.canViewLoanDetails,
  param("loanId").isMongoId().withMessage("Invalid loan ID format"),
  handleValidationErrors,
  checkLoanOwnership,
  getLoanPaymentSchedule
);

// Get overdue loans (ADMIN only)
router.get(
  "/overdue",
  Authenticated,
  loanRoleChecks.canViewOverdueLoans,
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("daysOverdue")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Days overdue must be a positive integer"),
  handleValidationErrors,
  getOverdueLoans
);

// Get loan analytics dashboard (All roles with role-based filtering)
router.get(
  "/analytics",
  Authenticated,
  hasRole([
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  query("period")
    .optional()
    .isIn(["daily", "weekly", "monthly", "yearly"])
    .withMessage("Invalid period"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
  handleValidationErrors,
  getLoanAnalytics
);

// ========== ADMIN-ONLY LOAN MANAGEMENT ROUTES ==========

// Cancel loan offer (Admin only)
router.put(
  "/admin/offers/:offerId/cancel",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN]),
  param("offerId").isMongoId().withMessage("Invalid offer ID format"),
  body("reason").notEmpty().withMessage("Cancellation reason is required"),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      // Implementation for admin loan offer cancellation
      res.status(200).json({
        success: true,
        message: "Admin loan offer cancellation - implement controller method",
        data: {
          offerId: req.params.offerId,
          reason: req.body.reason,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Force loan closure (Admin only)
router.put(
  "/admin/loans/:loanId/force-close",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN]),
  param("loanId").isMongoId().withMessage("Invalid loan ID format"),
  body("reason").notEmpty().withMessage("Closure reason is required"),
  body("settlementAmount")
    .optional()
    .isNumeric()
    .withMessage("Settlement amount must be a number"),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      // Implementation for admin force loan closure
      res.status(200).json({
        success: true,
        message: "Admin force loan closure - implement controller method",
        data: {
          loanId: req.params.loanId,
          reason: req.body.reason,
          settlementAmount: req.body.settlementAmount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get detailed loan analytics (Admin/Manager only)
router.get(
  "/admin/detailed-analytics",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER]),
  query("includePersonalData")
    .optional()
    .isBoolean()
    .withMessage("Include personal data must be boolean"),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      // Implementation for detailed admin analytics
      res.status(200).json({
        success: true,
        message: "Admin detailed analytics - implement controller method",
        data: {
          userRole: req.userRoles,
          allowedActions: [
            "view_all_loans",
            "view_personal_data",
            "generate_reports",
            "export_data",
          ],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
