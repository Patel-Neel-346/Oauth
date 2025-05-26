import express from "express";
import LoanOfferController from "../controller/LoanController/loanOfferController.js";
import LoanApplicationController from "../controller/LoanController/loanApplicationcontroller.js";
import P2PLoanController from "../controller/LoanController/P2PController.js";
import {
  Authenticated,
  //   authenticateToken,
  //   authorizeRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Loan Offer Routes
router.post(
  "/offers",
  Authenticated,
  //   authorizeRoles(["LENDER"]),
  LoanOfferController.createLoanOffer
);

router.get("/offers", Authenticated, LoanOfferController.getAllLoanOffers);

router.get(
  "/offers/:offerId",
  //   authenticateToken,
  Authenticated,
  LoanOfferController.getLoanOfferDetails
);

router.put(
  "/offers/:offerId",
  //   authenticateToken,
  Authenticated,

  //   authorizeRoles(["LENDER"]),
  LoanOfferController.updateLoanOffer
);

router.get(
  "/my-offers",
  //   authenticateToken,
  //   authorizeRoles(["LENDER"]),
  Authenticated,

  LoanOfferController.getLenderOffers
);

// Loan Application Routes
router.post(
  "/offers/:offerId/apply",
  //   authenticateToken,
  //   authorizeRoles(["BORROWER"]),
  Authenticated,

  LoanApplicationController.applyForLoan
);

router.put(
  "/applications/:applicationId/lender-review",
  //   authenticateToken,
  //   authorizeRoles(["LENDER"]),
  Authenticated,

  LoanApplicationController.lenderReviewApplication
);

router.put(
  "/applications/:applicationId/admin-approval",
  //   authenticateToken,
  //   authorizeRoles(["ADMIN"]),
  Authenticated,

  LoanApplicationController.adminFinalApproval
);

router.get(
  "/applications",
  //   authenticateToken,
  Authenticated,

  LoanApplicationController.getApplications
);

// P2P Loan Routes
router.post(
  "/disburse",
  //   authenticateToken,
  //   authorizeRoles(["ADMIN"]),
  Authenticated,

  P2PLoanController.disburseLoan
);

router.post(
  "/loans/:loanId/payment",
  //   authenticateToken,
  //   authorizeRoles(["BORROWER"]),
  Authenticated,

  P2PLoanController.makeLoanPayment
);

router.get(
  "/loans/:loanId",
  //   authenticateToken,
  Authenticated,

  P2PLoanController.getLoanDetails
);

router.get("/my-loans", Authenticated, P2PLoanController.getUserLoans);

router.get(
  "/loans/:loanId/schedule",
  //   authenticateToken,
  Authenticated,

  P2PLoanController.getLoanPaymentSchedule
);

router.get(
  "/overdue",
  //   authenticateToken,
  //   authorizeRoles(["ADMIN"]),
  Authenticated,

  P2PLoanController.getOverdueLoans
);

router.get("/analytics", Authenticated, P2PLoanController.getLoanAnalytics);

export default router;
