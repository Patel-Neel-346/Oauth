// src/routes/LoanRoute.js - Simplified Clean Version
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

const router = express.Router();

// ========== LOAN OFFER ROUTES ==========

// Create a new loan offer (Lender only)
router.post(
  "/offers",
  Authenticated,
  hasRole([ROLE_TYPES.LENDER]),
  CreateLoanOffer
);

// Get all active loan offers (All authenticated users)
router.get("/offers", Authenticated, GetAllLoanOffers);

// Get specific loan offer details (All authenticated users)
router.get("/offers/:offerId", Authenticated, GetLoanOfferDetail);

// Update loan offer (Lender only)
router.put(
  "/offers/:offerId",
  Authenticated,
  hasRole([ROLE_TYPES.LENDER]),
  UpdateLoanOffers
);

// Get lender's own loan offers (Lender only)
router.get(
  "/my-offers",
  Authenticated,
  hasRole([ROLE_TYPES.LENDER]),
  GetLenderOffers
);

// ========== LOAN APPLICATION ROUTES ==========

// Apply for a specific loan offer (Borrower only)
router.post(
  "/offers/:offerId/apply",
  Authenticated,
  hasRole([ROLE_TYPES.BORROWER]),
  ApplyForLoanController
);

// Lender review application (Lender only)
router.put(
  "/applications/:applicationId/lender-review",
  Authenticated,
  hasRole([ROLE_TYPES.LENDER]),
  LenderReviewApplicationController
);

// Admin final approval (Admin only)
router.put(
  "/applications/:applicationId/admin-approval",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN]),
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
  GetApplicationsController
);

// ========== LOAN MANAGEMENT ROUTES ==========

// Disburse loan after approval (Admin only)
router.post(
  "/disburse",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN]),
  disburseLoan
);

// Make loan payment (Borrower only)
router.post(
  "/loans/:loanId/payment",
  Authenticated,
  hasRole([ROLE_TYPES.BORROWER]),
  makeLoanPayment
);

// Get loan details (Borrower, Lender, Admin)
router.get(
  "/loans/:loanId",
  Authenticated,
  hasRole([ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER, ROLE_TYPES.ADMIN]),
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
  getUserLoans
);

// Get loan payment schedule (Borrower, Lender, Admin)
router.get(
  "/loans/:loanId/schedule",
  Authenticated,
  hasRole([ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER, ROLE_TYPES.ADMIN]),
  getLoanPaymentSchedule
);

// Get overdue loans (Admin, Manager only)
router.get(
  "/overdue",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER]),
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
