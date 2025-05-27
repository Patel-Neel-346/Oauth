import { ApiError } from "../helpers/ApiError";
import BorrowerProfile from "../models/BorrowerProfile";
import LoanApplication from "../models/Loan/LoanApplication";
import LoanOffer from "../models/Loan/LoanOffer";
import Role from "../models/Role";
import User from "../models/User";

class LoanApplicationServices {
  //to check eligibility for Borrowers
  static async CheckEligibility(borrowerProfile, criteria) {
    const checks = [];
    let allPassed = true;

    console.log(
      "Checking is that data Actully Passed Or Not",
      borrowerProfile,
      criteria
    );

    if (criteria.minCreditScore) {
      const creditPassed =
        borrowerProfile.creditScore >= criteria.minCreditScore;

      checks.push({
        name: "Credit Score",
        required: criteria.minCreditScore,
        actual: borrowerProfile.creditScore,
        passed: creditPassed,
      });

      if (!creditPassed) allPassed = false;
    }

    if (criteria.maxDebtToIncomeRatio) {
      const debtRatioPassed =
        borrowerProfile.debtToIncomeRatio <= criteria.maxDebtToIncomeRatio;

      checks.push({
        name: "Credit Score",
        required: criteria.maxDebtToIncomeRatio,
        actual: borrowerProfile.debtToIncomeRatio,
        passed: debtRatioPassed,
      });

      if (!debtRatioPassed) allPassed = false;
    }

    if (criteria.minMonthlyIncome) {
      const incomePassed =
        borrowerProfile.monthlyIncome >= criteria.minMonthlyIncome;

      checks.push({
        name: "Credit Score",
        required: criteria.minMonthlyIncome,
        actual: borrowerProfile.monthlyIncome,
        passed: incomePassed,
      });

      if (!incomePassed) allPassed = false;
    }
    if (criteria.employmentStatus?.length) {
      const employmentPassed = criteria.employmentStatus.includes(
        borrowerProfile.employmentStatus
      );
      checks.push({
        name: "Employment Status",
        required: criteria.employmentStatus.join(", "),
        actual: borrowerProfile.employmentStatus,
        passed: employmentPassed,
      });
      if (!employmentPassed) allPassed = false;
    }

    if (criteria.minEmploymentDuration) {
      const durationPassed =
        borrowerProfile.employmentDuration >= criteria.minEmploymentDuration;
      checks.push({
        name: "Employment Duration (months)",
        required: criteria.minEmploymentDuration,
        actual: borrowerProfile.employmentDuration,
        passed: durationPassed,
      });
      if (!durationPassed) allPassed = false;
    }

    return { passed: allPassed, criteria: checks, checkedAt: new Date() };
  }

  static async applyForLoan(req) {
    const { offerId } = req.params;
    const { requestedAmount, selectedTerm, purpose, purposeDescription } =
      req.body;

    //1. get loanOffer by id
    const loanOffer = await LoanOffer.findById(offerId);
    if (!loanOffer || loanOffer.status !== "active")
      return next(new ApiError(404, "Loan Offer not Found Man -_-"));

    //2. check user already applied for it
    const existing = await LoanApplication.findOne({
      loanOfferId: offerId,
      borrowerId: req.user.id,
      status: { $in: ["pending", "under_review", "approved"] },
    });

    if (existing)
      return next(
        new ApiError(
          404,
          "You have already Applied For this loan Man Try with Other Loan Offer  -_-"
        )
      );

    //3. get Borrower's Id
    const user = await User.findbyId(req.user);
    const borrowerRole = await Role.findOne({
      name: "borrower",
      users: user._id,
    });
    const borrowerProfile = await BorrowerProfile.findOne({
      roleId: borrowerRole._id,
    });

    //4 check if borrowerProfile exists
    if (!borrowerProfile)
      return next(new ApiError(404, "Borrower Profile not Found Man -_-"));

    //5 check Loan Amount Request For
    if (
      requestedAmount < loanOffer.minAmount ||
      requestedAmount > loanOffer.maxAmount
    )
      return next(
        new ApiError(
          404,
          `Requested amount must be between ${loanOffer.minAmount} and ${loanOffer.maxAmount} :()`
        )
      );

    //6 check if Funds Avalible Or Not

    if (requestedAmount > loanOffer.availableFunds)
      return next(
        new ApiError(
          404,
          "insufficient Funds Avaliable in this Offer try With Another One"
        )
      );

    //7 check Term's Options
    if (!loanOffer.termOptions.includes(selectedTerm))
      return next(
        new ApiError(404, "Selected term is not available for this offer :(")
      );

    //8 check ELIGIBILITY for loan
    const eligibilityResult = await LoanApplicationServices.CheckEligibility(
      borrowerProfile,
      loanOffer.eligibilityCriteria
    );

    const application = new LoanApplication({
      loanOfferId: offerId,
      borrowerId: user._id,
      lenderId: loanOffer.lenderId,
      requestedAmount,
      selectedTerm,
      purpose,
      purposeDescription,
      interestRate: loanOffer.interestRate,
      borrowerInfo: {
        monthlyIncome: borrowerProfile.monthlyIncome,
        employmentStatus: borrowerProfile.employmentDuration,
        employmentDuration: borrowerProfile.totalDebt,
        creditScore: borrowerProfile.creditScore,
        debtToIncomeRatio: borrowerProfile.debtToIncomeRatio,
      },
      eligibilityCheck: eligibilityResult,
      status: eligibilityResult.passed ? "pending" : "rejected",
      rejectionReason: eligibilityResult.passed
        ? null
        : "Does Not Meet Eligibility Criteria Man :( ",
    });

    await application.save();
    loanOffer.applications.push(application._id);
    loanOffer.totalApplications += 1;

    await loanOffer.save();

    return {
      applicationId: application._id,
      status: application.status,
      eligibilityPassed: eligibilityResult.passed,
      calculatedEMI: application.calculatedEMI,
      totalPaybleAmount: application.totalPayableAmount,
    };
  }

  static async lenderReviewApplication(req) {
    const { applicationId } = req.params;
    const { decision, comments } = req.body;

    //get Borrowers Application Details
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.id,
      status: "pending",
    });

    if (!application)
      return next(new ApiError(400, "Application Not Found -_-"));

    application.lenderDecision = {
      status: decision,
      comments,
      deciedeAt: new Date(),
    };

    application.status = decision === "approved" ? "under_review" : "rejected";
    await application.save();

    return { applicationId, status: application.status };
  }

  static async adminFinalApproval(req) {
    const { applicationId } = req.params;
    const { decision, comments } = req.body;

    const application = await LoanApplication.findOne({
      applicationId,
      status: "under_review",
    }).populate("loanOfferId");

    if (!application)
      return next(
        new ApiError(
          404,
          "Application not found or not ready for final Approval man so wait for Admin to Approve you Loan Application"
        )
      );

    application.adminDecision = {
      status: decision,
      comments,
      reviewedBy: req.user.id,
      decidedAt: new Date(),
    };

    if (decision === "approved" || decision === "Approved") {
      application.status = "approved";
      application.approvalDate = new Date();
      const loanOffer = application.loanOfferId;
      loanOffer.availableFunds -= application.requestedAmount;
      loanOffer.approvedApplications += 1;
      await loanOffer.save();
    } else {
      application.status = "rejected";
    }

    await application.save();
    return { applicationId, status: application.status };
  }

  static async getApplications(req) {
    const { status, page = 1, limit = 10 } = req.query;
    const user = await User.findById(req.user.id);
    const query = {};

    if (user.roles.includes("BORROWER")) {
      query.borrowerId = req.user.id;
    } else if (user.roles.includes("LENDER")) {
      query.lenderId = req.user.id;
    }

    if (status) query.status = status;

    const applications = await LoanApplication.find(query)
      .populate("borrowerId", "firstName lastName email")
      .populate("lenderId", "firstName lastName email")
      .populate("loanOfferId", "title interestRate")
      .sort({ applicationDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await LoanApplication.countDocuments(query);
    return {
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export default LoanApplicationServices;
