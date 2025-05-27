import { asyncHandler } from "../helpers/asyncHandler.js";
import { ApiError } from "../helpers/ApiError.js";
import { ApiRes } from "../helpers/ApiRespones.js";
import LoanOfferService from "../services/LoanOfferService.js";
import LoanApplicationServices from "../services/LoanApplicationService.js";
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
      req.user.id,
      req.query
    );
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
  const application = LoanApplicationServices.applyForLoan(req);

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
});

//lender only
export const LenderReviewApplicationController = asyncHandler(
  async (req, res, next) => {
    const result = LoanApplicationServices.lenderReviewApplication(req);

    if (!result)
      return next(
        new ApiError(404, "There has been Error In Review Application for loan")
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
  }
);

//admin only
export const AdminFinalApprovalController = asyncHandler(
  async (req, res, next) => {
    const result = LoanApplicationServices.adminFinalApproval(req);
    if (!result)
      return next(
        new ApiError(404, "There has been Error In Review Application for loan")
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
  }
);

//get Application based on Role's
export const GetApplicationsController = asyncHandler(
  async (req, res, next) => {
    const result = LoanApplicationServices.getApplications(req);

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          result,
          "All the Application Has be Fetched SuccessFully :)"
        )
      );
  }
);
