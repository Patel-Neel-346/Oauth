// src/routes/LoanRoute.js
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
import { hasRole, ROLE_TYPES } from "../middleware/roleMiddleware.js";
import {
  createLoanOfferValidation,
  updateLoanOfferValidation,
  getLoanOffersValidation,
  getLoanOfferDetailValidation,
  getLenderOffersValidation,
  applyForLoanValidation,
  lenderReviewValidation,
  adminApprovalValidation,
  getApplicationsValidation,
  disburseLoanValidation,
  makeLoanPaymentValidation,
  getLoanDetailsValidation,
  getUserLoansValidation,
  getLoanPaymentScheduleValidation,
  getOverdueLoansValidation,
} from "../middleware/loanValidation.js";

const router = express.Router();

// ========== LOAN OFFER ROUTES ==========

// Create a new loan offer (Lender only)
router.post(
  "/offers",
  Authenticated,
  hasRole([ROLE_TYPES.LENDER]),
  createLoanOfferValidation,
  CreateLoanOffer
);

// Get all active loan offers (All authenticated users)
router.get("/offers", Authenticated, getLoanOffersValidation, GetAllLoanOffers);

// Get specific loan offer details (All authenticated users)
router.get(
  "/offers/:offerId",
  Authenticated,
  getLoanOfferDetailValidation,
  GetLoanOfferDetail
);

// Update loan offer (Lender only)
router.put(
  "/offers/:offerId",
  Authenticated,
  hasRole([ROLE_TYPES.LENDER]),
  updateLoanOfferValidation,
  UpdateLoanOffers
);

// Get lender's own loan offers (Lender only)
router.get(
  "/my-offers",
  Authenticated,
  hasRole([ROLE_TYPES.LENDER]),
  getLenderOffersValidation,
  GetLenderOffers
);

// ========== LOAN APPLICATION ROUTES ==========

// Apply for a specific loan offer (Borrower only)
router.post(
  "/offers/:offerId/apply",
  Authenticated,
  hasRole([ROLE_TYPES.BORROWER]),
  applyForLoanValidation,
  ApplyForLoanController
);

// Lender review application (Lender only)
router.put(
  "/applications/:applicationId/lender-review",
  Authenticated,
  hasRole([ROLE_TYPES.LENDER]),
  lenderReviewValidation,
  LenderReviewApplicationController
);

// Admin final approval (Admin only)
router.put(
  "/applications/:applicationId/admin-approval",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN]),
  adminApprovalValidation,
  AdminFinalApprovalController
);

// Get applications (Borrower, Lender, Admin, Manager)
router.get(
  "/applications",
  Authenticated,
  hasRole([
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  getApplicationsValidation,
  GetApplicationsController
);

// ========== LOAN MANAGEMENT ROUTES ==========

// Disburse loan after approval (Admin only)
router.post(
  "/disburse",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN]),
  disburseLoanValidation,
  disburseLoan
);

// Make loan payment (Borrower only)
router.post(
  "/loans/:loanId/payment",
  Authenticated,
  hasRole([ROLE_TYPES.BORROWER]),
  makeLoanPaymentValidation,
  makeLoanPayment
);

// Get loan details (Borrower, Lender, Admin)
router.get(
  "/loans/:loanId",
  Authenticated,
  hasRole([ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER, ROLE_TYPES.ADMIN]),
  getLoanDetailsValidation,
  getLoanDetails
);

// Get user's loans (Borrower, Lender, Admin, Manager)
router.get(
  "/my-loans",
  Authenticated,
  hasRole([
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  getUserLoansValidation,
  getUserLoans
);

// Get loan payment schedule (Borrower, Lender, Admin)
router.get(
  "/loans/:loanId/schedule",
  Authenticated,
  hasRole([ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER, ROLE_TYPES.ADMIN]),
  getLoanPaymentScheduleValidation,
  getLoanPaymentSchedule
);

// Get overdue loans (Admin, Manager only)
router.get(
  "/overdue",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER]),
  getOverdueLoansValidation,
  getOverdueLoans
);

// Get loan analytics (All roles)
router.get(
  "/analytics",
  Authenticated,
  hasRole([
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  getLoanAnalytics
);

export default router;
