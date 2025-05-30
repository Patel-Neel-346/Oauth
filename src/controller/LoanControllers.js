import { asyncHandler } from "../helpers/asyncHandler.js";
import { ApiError } from "../helpers/ApiError.js";
import { ApiRes } from "../helpers/ApiRespones.js";
import LoanOfferService from "../services/LoanOfferService.js";
import LoanApplicationServices from "../services/LoanApplicationService.js";
import P2PLoanService from "../services/P2PLoanServiceV2.js";
// import LoanApplicationService from "./LoanController/loanApplicationcontroller.js";

// Here All Loan offer Controller Here
export const CreateLoanOffer = asyncHandler(async (req, res, next) => {
  try {
    const offer = await LoanOfferService.createLoanOfferService(req);
    console.log(offer);

    if (!offer)
      return next(
        new ApiError(401, "Failed To Create Loan Offer Try Again -_-")
      );

    res
      .status(201)
      .json(new ApiRes(201, offer, "Loan Offer Created SuccessFully Yeyeye"));
  } catch (error) {
    console.log(error);
    return next(new ApiError(500, `Error:${error.message}`));
  }
});

export const GetAllLoanOffers = asyncHandler(async (req, res, next) => {
  try {
    const result = await LoanOfferService.getAllLoanOffersService(req.query);

    if (!result)
      return next(
        new ApiError(401, "Failed To Get All Loan Offer Try Again -_-")
      );

    res
      .status(200)
      .json(new ApiRes(200, result, "Loan Offer  SuccessFully Fatched Yeyeye"));
  } catch (error) {
    console.log(error);
    return next(new ApiError(500, `Error:${error.message}`));
  }
});

export const GetLoanOfferDetail = asyncHandler(async (req, res, next) => {
  try {
    const offer = await LoanOfferService.getLoanOfferDetailsService(
      req.params.offerId
    );

    if (!offer)
      return next(new ApiError(401, "Failed To Get  Loan Offer Try Again -_-"));

    res
      .status(200)
      .json(
        new ApiRes(200, offer, "Loan Offer  SuccessFully Fatched Yeyeye :)")
      );
  } catch (error) {
    console.log(error);
    return next(new ApiError(500, `Error:${error.message}`));
  }
});

export const UpdateLoanOffers = asyncHandler(async (req, res, next) => {
  try {
    const updateData = await LoanOfferService.updateLoanOfferService(
      req.params.offerId,
      req.user.id,
      req.body
    );

    if (!updateData)
      return next(new ApiError(401, "Failed To Get  Loan Offer Try Again -_-"));

    res
      .status(200)
      .json(
        new ApiRes(
          200,
          updateData,
          "Loan Offer Data  SuccessFully Updated  Yeyeye :)"
        )
      );
  } catch (error) {
    console.log(error);
    return next(new ApiError(500, `Error:${error.message}`));
  }
});

export const GetLenderOffers = asyncHandler(async (req, res, next) => {
  try {
    const result = await LoanOfferService.getLenderOfferSerivces(
      req.user,
      req.params
    );
    // console.log(req.user);
    if (!result)
      return next(
        new ApiError(401, "Failed To Get Lender's Loan Offer Try Again -_-")
      );

    res
      .status(200)
      .json(
        new ApiRes(
          200,
          result,
          "Lender Offer Data has be SuccessFully Fatched yeyeye  :)"
        )
      );
  } catch (error) {
    console.log(error);
    return next(new ApiError(500, `Error:${error.message}`));
  }
});

//Here All Loan Application Controller Here

//borrow's only
export const ApplyForLoanController = asyncHandler(async (req, res, next) => {
  try {
    const application = LoanApplicationServices.applyForLoan(req, next);

    if (!application)
      return next(
        new ApiError(
          400,
          "Some Error occure During Creating Your Applications :("
        )
      );

    return res
      .status(201)
      .json(
        new ApiRes(
          201,
          application,
          "Your Application OF Loan Has been Created SuccessFully Wait For Approval :)"
        )
      );
  } catch (error) {
    console.log(error);
    return new ApiError(500, "Internel Server at Loan Controller");
  }
});

//lender only
export const LenderReviewApplicationController = asyncHandler(
  async (req, res, next) => {
    try {
      const result = LoanApplicationServices.lenderReviewApplication(req, next);

      if (!result)
        return next(
          new ApiError(
            404,
            "There has been Error In Review Application for loan"
          )
        );
      return res
        .status(200)
        .json(
          new ApiRes(
            200,
            result,
            "Your Application For loan Has been Approved SuccessFully By Lender :)"
          )
        );
    } catch (error) {
      console.log(error);
      return new ApiError(500, "Internel Server at Loan Controller");
    }
  }
);

//admin only
export const AdminFinalApprovalController = asyncHandler(
  async (req, res, next) => {
    try {
      const result = LoanApplicationServices.adminFinalApproval(req, next);
      if (!result)
        return next(
          new ApiError(
            404,
            "There has been Error In Review Application for loan"
          )
        );
      return res
        .status(200)
        .json(
          new ApiRes(
            200,
            result,
            "Your Application For loan Has been Approved SuccessFully By Admin :)"
          )
        );
    } catch (error) {
      console.log(error);
      return new ApiError(500, "Internel Server at Loan Controller");
    }
  }
);

//get Application based on Role's
export const GetApplicationsController = asyncHandler(
  async (req, res, next) => {
    try {
      const result = LoanApplicationServices.getApplications(req, next);

      return res
        .status(200)
        .json(
          new ApiRes(
            200,
            result,
            "All the Application Has be Fetched SuccessFully :)"
          )
        );
    } catch (error) {
      console.log(error);
      return new ApiError(500, "Internel Server at Loan Controller");
    }
  }
);

// Disburse loan after approval (ADMIN only)
export const disburseLoan = asyncHandler(async (req, res) => {
  const { applicationId, borrowerAccountId } = req.body;

  try {
    const result = await P2PLoanService.disburseLoan(
      applicationId,
      borrowerAccountId
    );

    res.status(201).json({
      success: true,
      message: "Loan disbursed successfully",
      data: result,
    });
  } catch (error) {
    if (error.message === "Approved application not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message === "Valid accounts not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message === "Insufficient balance in lender account") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error disbursing loan",
      error: error.message,
    });
  }
});

// Make loan payment (BORROWER only)
export const makeLoanPayment = asyncHandler(async (req, res) => {
  const { loanId } = req.params;
  const { paymentAmount, accountId } = req.body;
  console.log("USERID:", req.user);
  try {
    const result = await P2PLoanService.makeLoanPayment(
      loanId,
      paymentAmount,
      accountId,
      req.user
    );

    res.json({
      success: true,
      message: "Payment made successfully",
      data: result,
    });
  } catch (error) {
    if (error.message === "Active loan not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.message === "Insufficient balance or invalid account" ||
      error.message === "Lender account not found"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error processing payment",
      error: error.message,
    });
  }
});

// Get loan details
export const getLoanDetails = asyncHandler(async (req, res) => {
  const { loanId } = req.params;

  try {
    const loan = await P2PLoanService.getLoanDetails(loanId, req.user);

    res.json({
      success: true,
      data: loan,
    });
  } catch (error) {
    if (error.message === "Loan not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message === "Access denied") {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error fetching loan details",
      error: error.message,
    });
  }
});

// Get user's loans (borrower/lender)
export const getUserLoans = asyncHandler(async (req, res) => {
  const { type, status, page = 1, limit = 10 } = req.query;

  try {
    const result = await P2PLoanService.getUserLoans(req.user, {
      type,
      status,
      page,
      limit,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching loans",
      error: error.message,
    });
  }
});

// Get loan payment schedule
export const getLoanPaymentSchedule = asyncHandler(async (req, res) => {
  const { loanId } = req.params;

  try {
    const result = await P2PLoanService.getLoanPaymentSchedule(
      loanId,
      req.user
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error.message === "Loan not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message === "Access denied") {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error generating payment schedule",
      error: error.message,
    });
  }
});

// Get overdue loans (ADMIN)
export const getOverdueLoans = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  try {
    const result = await P2PLoanService.getOverdueLoans({ page, limit });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching overdue loans",
      error: error.message,
    });
  }
});

// Loan analytics dashboard
export const getLoanAnalytics = asyncHandler(async (req, res) => {
  try {
    const result = await P2PLoanService.getLoanAnalytics(req.user);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching loan analytics",
      error: error.message,
    });
  }
});
