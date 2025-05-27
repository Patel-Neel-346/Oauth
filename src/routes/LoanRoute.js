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
} from "../controller/LoanControllers.js";
import { Authenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

// ========== LOAN OFFER ROUTES ==========

// Create a new loan offer (Lender only)
router.post("/offers", Authenticated, CreateLoanOffer);

// Get all active loan offers (Public/Authenticated users)
router.get("/offers", Authenticated, GetAllLoanOffers);

// Get specific loan offer details
router.get("/offers/:offerId", Authenticated, GetLoanOfferDetail);

// Update loan offer (Lender only - own offers)
router.put("/offers/:offerId", Authenticated, UpdateLoanOffers);

// Get lender's own loan offers
router.get("/my-offers", Authenticated, GetLenderOffers);

// ========== LOAN APPLICATION ROUTES ==========

// Apply for a specific loan offer (Borrower only)
router.post("/offers/:offerId/apply", Authenticated, ApplyForLoanController);

// Lender review application (Lender only)
router.put(
  "/applications/:applicationId/lender-review",
  Authenticated,
  LenderReviewApplicationController
);

// Admin final approval (Admin only)
router.put(
  "/applications/:applicationId/admin-approval",
  Authenticated,
  AdminFinalApprovalController
);

// Get applications based on user role
router.get("/applications", Authenticated, GetApplicationsController);

export default router;
