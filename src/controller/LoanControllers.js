import { asyncHandler } from "../helpers/asyncHandler.js";
import { ApiError } from "../helpers/ApiError.js";
import { ApiRes } from "../helpers/ApiRespones.js";
import LoanOfferService from "../services/LoanOfferService.js";
import LoanApplicationServices from "../services/LoanApplicationService.js";
import P2PLoanService from "../services/P2PLoanServiceV2.js";

// Here All Loan offer Controller Here
export const CreateLoanOffer = asyncHandler(async (req, res, next) => {
  try {
    const offer = await LoanOfferService.createLoanOfferService(req);
    // console.log(offer);

    if (!offer) {
      return next(
        new ApiError(401, "Failed To Create Loan Offer Try Again -_-")
      );
    }

    return res
      .status(201)
      .json(new ApiRes(201, offer, "Loan Offer Created Successfully"));
  } catch (error) {
    console.error("CreateLoanOffer Error:", error);
    return next(new ApiError(500, `Error: ${error.message}`));
  }
});

export const GetAllLoanOffers = asyncHandler(async (req, res, next) => {
  try {
    const result = await LoanOfferService.getAllLoanOffersService(req.query);

    if (!result) {
      return next(new ApiError(404, "No loan offers found"));
    }

    return res
      .status(200)
      .json(new ApiRes(200, result, "Loan Offers Successfully Fetched"));
  } catch (error) {
    console.error("GetAllLoanOffers Error:", error);
    return next(new ApiError(500, `Error: ${error.message}`));
  }
});

export const GetLoanOfferDetail = asyncHandler(async (req, res, next) => {
  try {
    const { offerId } = req.params;

    if (!offerId) {
      return next(new ApiError(400, "Offer ID is required"));
    }

    const offer = await LoanOfferService.getLoanOfferDetailsService(offerId);

    if (!offer) {
      return next(new ApiError(404, "Loan offer not found"));
    }

    return res
      .status(200)
      .json(new ApiRes(200, offer, "Loan Offer Successfully Fetched"));
  } catch (error) {
    console.error("GetLoanOfferDetail Error:", error);
    return next(new ApiError(500, `Error: ${error.message}`));
  }
});

export const UpdateLoanOffers = asyncHandler(async (req, res, next) => {
  try {
    const { offerId } = req.params;

    if (!offerId) {
      return next(new ApiError(400, "Offer ID is required"));
    }

    if (!req.user) {
      return next(new ApiError(401, "User authentication required"));
    }

    const updateData = await LoanOfferService.updateLoanOfferService(
      offerId,
      req.user,
      req.body
    );

    if (!updateData) {
      return next(new ApiError(404, "Loan offer not found or update failed"));
    }

    return res
      .status(200)
      .json(new ApiRes(200, updateData, "Loan Offer Successfully Updated"));
  } catch (error) {
    console.error("UpdateLoanOffers Error:", error);
    return next(new ApiError(500, `Error: ${error.message}`));
  }
});

export const GetLenderOffers = asyncHandler(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, "User authentication required"));
    }

    const result = await LoanOfferService.getLenderOfferSerivces(
      req.user,
      req.params
    );

    if (!result) {
      return next(new ApiError(404, "No offers found for this lender"));
    }

    return res
      .status(200)
      .json(new ApiRes(200, result, "Lender Offers Successfully Fetched"));
  } catch (error) {
    console.error("GetLenderOffers Error:", error);
    return next(new ApiError(500, `Error: ${error.message}`));
  }
});

//Here All Loan Application Controller Here

//borrower's only
export const ApplyForLoanController = asyncHandler(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, "User authentication required"));
    }

    // Add await here - this was missing!
    const application = await LoanApplicationServices.applyForLoan(req, next);

    if (!application) {
      return next(
        new ApiError(400, "Error occurred during loan application creation")
      );
    }

    return res
      .status(201)
      .json(
        new ApiRes(
          201,
          application,
          "Your Loan Application Has Been Created Successfully"
        )
      );
  } catch (error) {
    console.error("ApplyForLoanController Error:", error);
    return next(new ApiError(500, `Internal Server Error: ${error.message}`));
  }
});

//lender only
export const LenderReviewApplicationController = asyncHandler(
  async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, "User authentication required"));
      }

      const { decision } = req.body;
      if (!decision || !["approved", "rejected"].includes(decision)) {
        return next(
          new ApiError(400, "Valid decision (approved/rejected) is required")
        );
      }

      // Add await here - this was missing!
      const result = await LoanApplicationServices.lenderReviewApplication(
        req,
        next
      );

      if (!result) {
        return next(new ApiError(404, "Error in reviewing loan application"));
      }

      return res
        .status(200)
        .json(
          new ApiRes(200, result, "Loan Application Reviewed Successfully")
        );
    } catch (error) {
      console.error("LenderReviewApplicationController Error:", error);
      return next(new ApiError(500, `Internal Server Error: ${error.message}`));
    }
  }
);

//admin only
export const AdminFinalApprovalController = asyncHandler(
  async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, "User authentication required"));
      }

      const { decision } = req.body;
      if (
        !decision ||
        !["approved", "rejected"].includes(decision.toLowerCase())
      ) {
        return next(
          new ApiError(400, "Valid decision (approved/rejected) is required")
        );
      }

      // Add await here - this was missing!
      const result = await LoanApplicationServices.adminFinalApproval(
        req,
        next
      );

      if (!result) {
        return next(new ApiError(404, "Error in final approval process"));
      }

      return res
        .status(200)
        .json(
          new ApiRes(
            200,
            result,
            "Loan Application Final Approval Completed Successfully"
          )
        );
    } catch (error) {
      console.error("AdminFinalApprovalController Error:", error);
      return next(new ApiError(500, `Internal Server Error: ${error.message}`));
    }
  }
);

//get Application based on Role's
export const GetApplicationsController = asyncHandler(
  async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, "User authentication required"));
      }

      // Add await here - this was missing!
      const result = await LoanApplicationServices.getApplications(req, next);

      if (!result) {
        return next(new ApiError(404, "No applications found"));
      }

      return res
        .status(200)
        .json(new ApiRes(200, result, "Applications Successfully Fetched"));
    } catch (error) {
      console.error("GetApplicationsController Error:", error);
      return next(new ApiError(500, `Internal Server Error: ${error.message}`));
    }
  }
);

// Disburse loan after approval (ADMIN only)
export const disburseLoan = asyncHandler(async (req, res, next) => {
  try {
    const { applicationId, borrowerAccountId } = req.body;

    if (!applicationId || !borrowerAccountId) {
      return next(
        new ApiError(400, "Application ID and Borrower Account ID are required")
      );
    }

    const result = await P2PLoanService.disburseLoan(
      applicationId,
      borrowerAccountId
    );

    if (!result) {
      return next(new ApiError(400, "Failed to disburse loan"));
    }

    return res
      .status(201)
      .json(new ApiRes(201, result, "Loan disbursed successfully"));
  } catch (error) {
    console.error("disburseLoan Error:", error);

    if (error.message === "Approved application not found") {
      return next(new ApiError(404, error.message));
    }

    if (error.message === "Valid accounts not found") {
      return next(new ApiError(404, error.message));
    }

    if (error.message === "Insufficient balance in lender account") {
      return next(new ApiError(400, error.message));
    }

    return next(new ApiError(500, `Error disbursing loan: ${error.message}`));
  }
});

// Make loan payment (BORROWER only)
export const makeLoanPayment = asyncHandler(async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const { paymentAmount, accountId } = req.body;

    if (!loanId) {
      return next(new ApiError(400, "Loan ID is required"));
    }

    if (!paymentAmount || !accountId) {
      return next(
        new ApiError(400, "Payment amount and account ID are required")
      );
    }

    if (!req.user) {
      return next(new ApiError(401, "User authentication required"));
    }

    // console.log("USERID:", req.user);

    const result = await P2PLoanService.makeLoanPayment(
      loanId,
      paymentAmount,
      accountId,
      req.user
    );

    if (!result) {
      return next(new ApiError(400, "Failed to process payment"));
    }

    return res.json(new ApiRes(200, result, "Payment made successfully"));
  } catch (error) {
    console.error("makeLoanPayment Error:", error);

    if (error.message === "Active loan not found") {
      return next(new ApiError(404, error.message));
    }

    if (
      error.message === "Insufficient balance or invalid account" ||
      error.message === "Lender account not found"
    ) {
      return next(new ApiError(400, error.message));
    }

    return next(
      new ApiError(500, `Error processing payment: ${error.message}`)
    );
  }
});

// Get loan details
export const getLoanDetails = asyncHandler(async (req, res, next) => {
  try {
    const { loanId } = req.params;

    if (!loanId) {
      return next(new ApiError(400, "Loan ID is required"));
    }

    if (!req.user) {
      return next(new ApiError(401, "User authentication required"));
    }

    const loan = await P2PLoanService.getLoanDetails(loanId, req.user);

    if (!loan) {
      return next(new ApiError(404, "Loan not found"));
    }

    return res.json(new ApiRes(200, loan, "Loan details fetched successfully"));
  } catch (error) {
    console.error("getLoanDetails Error:", error);

    if (error.message === "Loan not found") {
      return next(new ApiError(404, error.message));
    }

    if (error.message === "Access denied") {
      return next(new ApiError(403, error.message));
    }

    return next(
      new ApiError(500, `Error fetching loan details: ${error.message}`)
    );
  }
});

// Get user's loans (borrower/lender)
export const getUserLoans = asyncHandler(async (req, res, next) => {
  try {
    const { type, status, page = 1, limit = 10 } = req.query;

    if (!req.user) {
      return next(new ApiError(401, "User authentication required"));
    }

    const result = await P2PLoanService.getUserLoans(req.user, {
      type,
      status,
      page,
      limit,
    });

    if (!result) {
      return next(new ApiError(404, "No loans found"));
    }

    return res.json(new ApiRes(200, result, "User loans fetched successfully"));
  } catch (error) {
    console.error("getUserLoans Error:", error);
    return next(new ApiError(500, `Error fetching loans: ${error.message}`));
  }
});

// Get loan payment schedule
export const getLoanPaymentSchedule = asyncHandler(async (req, res, next) => {
  try {
    const { loanId } = req.params;

    if (!loanId) {
      return next(new ApiError(400, "Loan ID is required"));
    }

    if (!req.user) {
      return next(new ApiError(401, "User authentication required"));
    }

    const result = await P2PLoanService.getLoanPaymentSchedule(
      loanId,
      req.user
    );

    if (!result) {
      return next(new ApiError(404, "Payment schedule not found"));
    }

    return res.json(
      new ApiRes(200, result, "Payment schedule fetched successfully")
    );
  } catch (error) {
    console.error("getLoanPaymentSchedule Error:", error);

    if (error.message === "Loan not found") {
      return next(new ApiError(404, error.message));
    }

    if (error.message === "Access denied") {
      return next(new ApiError(403, error.message));
    }

    return next(
      new ApiError(500, `Error generating payment schedule: ${error.message}`)
    );
  }
});

// Get overdue loans (ADMIN)
export const getOverdueLoans = asyncHandler(async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const result = await P2PLoanService.getOverdueLoans({ page, limit });

    if (!result) {
      return next(new ApiError(404, "No overdue loans found"));
    }

    return res.json(
      new ApiRes(200, result, "Overdue loans fetched successfully")
    );
  } catch (error) {
    console.error("getOverdueLoans Error:", error);
    return next(
      new ApiError(500, `Error fetching overdue loans: ${error.message}`)
    );
  }
});

// Loan analytics dashboard
export const getLoanAnalytics = asyncHandler(async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, "User authentication required"));
    }

    const result = await P2PLoanService.getLoanAnalytics(req.user);

    if (!result) {
      return next(new ApiError(404, "No analytics data found"));
    }

    return res.json(
      new ApiRes(200, result, "Loan analytics fetched successfully")
    );
  } catch (error) {
    console.error("getLoanAnalytics Error:", error);
    return next(
      new ApiError(500, `Error fetching loan analytics: ${error.message}`)
    );
  }
});
