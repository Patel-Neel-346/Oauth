import mongoose from "mongoose";
import { ApiError } from "../helpers/ApiError.js";
import BorrowerProfile from "../models/BorrowerProfile.js";
import LoanApplication from "../models/Loan/LoanApplication.js";
import LoanOffer from "../models/Loan/LoanOffer.js";
import Role from "../models/Role.js";
import User from "../models/User.js";

class LoanApplicationServices {
  //to check eligibility for Borrowers
  static async CheckEligibility(borrowerProfile, criteria) {
    try {
      const checks = [];
      let allPassed = true;

      // console.log("Checking eligibility data:", borrowerProfile, criteria);

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
          name: "Debt to Income Ratio",
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
          name: "Monthly Income",
          required: criteria.minMonthlyIncome,
          actual: borrowerProfile.monthlyIncome,
          passed: incomePassed,
        });

        if (!incomePassed) allPassed = false;
      }

      return { passed: allPassed, criteria: checks, checkedAt: new Date() };
    } catch (error) {
      console.error("CheckEligibility Error:", error);
      throw new ApiError(500, `Error checking eligibility: ${error.message}`);
    }
  }

  static async applyForLoan(req, next) {
    try {
      const { offerId } = req.params;
      const { requestedAmount, selectedTerm, purpose, purposeDescription } =
        req.body;

      // Validate required fields
      if (!offerId) {
        throw new ApiError(400, "Loan offer ID is required");
      }

      if (!requestedAmount || !selectedTerm) {
        throw new ApiError(
          400,
          "Requested amount and selected term are required"
        );
      }

      //1. get loanOffer by id
      const loanOffer = await LoanOffer.findById(offerId);
      if (!loanOffer || loanOffer.status !== "active") {
        throw new ApiError(404, "Active loan offer not found");
      }

      //2. check user already applied for it
      const existing = await LoanApplication.findOne({
        loanOfferId: offerId,
        borrowerId: req.user.id,
        status: { $in: ["pending", "under_review", "approved"] },
      });

      if (existing) {
        throw new ApiError(
          409,
          "You have already applied for this loan. Try with another loan offer."
        );
      }

      //3. get Borrower's Id
      const user = await User.findById(req.user.id || req.user);
      if (!user) {
        throw new ApiError(404, "User not found");
      }

      const borrowerRole = await Role.findOne({
        name: "borrower",
        users: user._id,
      });

      if (!borrowerRole) {
        throw new ApiError(404, "Borrower role not found for user");
      }

      const borrowerProfile = await BorrowerProfile.findOne({
        roleId: borrowerRole._id,
      });

      //4 check if borrowerProfile exists
      if (!borrowerProfile) {
        throw new ApiError(
          404,
          "Borrower profile not found. Please complete your profile first."
        );
      }

      //5 check Loan Amount Request For
      if (
        requestedAmount < loanOffer.minAmount ||
        requestedAmount > loanOffer.maxAmount
      ) {
        throw new ApiError(
          400,
          `Requested amount must be between ${loanOffer.minAmount} and ${loanOffer.maxAmount}`
        );
      }

      //6 check if Funds Available Or Not
      if (requestedAmount > loanOffer.availableFunds) {
        throw new ApiError(
          400,
          "Insufficient funds available in this offer. Try with another one."
        );
      }

      //7 check Term's Options
      if (!loanOffer.termOptions.includes(selectedTerm)) {
        throw new ApiError(
          400,
          "Selected term is not available for this offer"
        );
      }

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
          employmentStatus: borrowerProfile.employmentStatus,
          employmentDuration: borrowerProfile.employmentDuration,
          creditScore: borrowerProfile.creditScore,
          debtToIncomeRatio: borrowerProfile.debtToIncomeRatio,
        },
        eligibilityCheck: eligibilityResult,
        status: eligibilityResult.passed ? "pending" : "rejected",
        rejectionReason: eligibilityResult.passed
          ? null
          : "Does not meet eligibility criteria",
      });

      await application.save();
      loanOffer.applications.push(application._id);
      loanOffer.totalApplications += 1;

      await loanOffer.save();

      return {
        applicationId: application.applicationId,
        status: application.status,
        eligibilityPassed: eligibilityResult.passed,
        eligibilityChecks: eligibilityResult.criteria,
        calculatedEMI: application.calculatedEMI,
        totalPayableAmount: application.totalPayableAmount,
        message: eligibilityResult.passed
          ? "Application submitted successfully and is pending review"
          : "Application rejected due to eligibility criteria",
      };
    } catch (error) {
      console.error("applyForLoan Error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500,
        `Error processing loan application: ${error.message}`
      );
    }
  }

  static async lenderReviewApplication(req, next) {
    try {
      const { applicationId } = req.params;
      const { decision, comments } = req.body;

      if (!applicationId) {
        throw new ApiError(400, "Application ID is required");
      }

      if (!decision || !["approved", "rejected"].includes(decision)) {
        throw new ApiError(
          400,
          "Valid decision (approved/rejected) is required"
        );
      }

      const lenderId =
        typeof req.user === "string" ? req.user : req.user._id || req.user.id;

      // console.log("Received Application ID:", applicationId);
      // console.log("Authenticated Lender ID:", lenderId);

      // Fixed the query - should use _id instead of applicationId
      const application = await LoanApplication.findOne({
        applicationId: applicationId,
        lenderId,
        status: "pending",
      });

      // console.log("Fetched Application:", application);

      if (!application) {
        throw new ApiError(404, "Application not found or not accessible");
      }

      application.lenderDecision = {
        status: decision,
        comments,
        decidedAt: new Date(),
      };

      application.status =
        decision === "approved" ? "under_review" : "rejected";
      if (decision === "rejected") {
        application.rejectionReason = comments || "Rejected by lender";
      }

      await application.save();

      return {
        applicationId: application.applicationId,
        status: application.status,
        decision: decision,
        message:
          decision === "approved"
            ? "Application approved and forwarded for admin review"
            : "Application rejected by lender",
      };
    } catch (error) {
      console.error("lenderReviewApplication Error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Error reviewing application: ${error.message}`);
    }
  }

  static async adminFinalApproval(req, next) {
    try {
      const { applicationId } = req.params;
      const { decision, comments } = req.body;

      if (!applicationId) {
        throw new ApiError(400, "Application ID is required");
      }

      if (
        !decision ||
        !["approved", "rejected"].includes(decision.toLowerCase())
      ) {
        throw new ApiError(
          400,
          "Valid decision (approved/rejected) is required"
        );
      }

      // Fixed the query - should use _id instead of applicationId
      const application = await LoanApplication.findOne({
        applicationId: applicationId,
        status: "under_review",
      }).populate("loanOfferId");

      if (!application) {
        throw new ApiError(
          404,
          "Application not found or not ready for final approval"
        );
      }

      application.adminDecision = {
        status: decision.toLowerCase(),
        comments,
        reviewedBy: req.user.id || req.user._id,
        decidedAt: new Date(),
      };

      if (decision.toLowerCase() === "approved") {
        application.status = "approved";
        application.approvalDate = new Date();

        const loanOffer = application.loanOfferId;
        loanOffer.availableFunds -= application.requestedAmount;
        loanOffer.approvedApplications += 1;
        await loanOffer.save();
      } else {
        application.status = "rejected";
        application.rejectionReason = comments || "Rejected by admin";
      }

      await application.save();

      return {
        applicationId: application.applicationId,
        status: application.status,
        decision: decision.toLowerCase(),
        message:
          decision.toLowerCase() === "approved"
            ? "Application approved successfully"
            : "Application rejected by admin",
      };
    } catch (error) {
      console.error("adminFinalApproval Error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500,
        `Error processing final approval: ${error.message}`
      );
    }
  }

  static async getApplications(req, next) {
    try {
      const { status, page = 1, limit = 10 } = req.query;

      const user = await User.findById(req.user.id || req.user);
      if (!user) {
        throw new ApiError(404, "User not found");
      }

      const userRole = await Role.findOne({
        $or: [
          { name: "borrower", users: user._id },
          { name: "lender", users: user._id },
        ],
      });

      if (!userRole) {
        throw new ApiError(403, "User role not found");
      }

      // console.log("User:", user);
      // console.log("User Role:", userRole);

      const query = {};

      // Build query based on user role
      if (userRole.name === "borrower") {
        query.borrowerId = user._id;
      } else if (userRole.name === "lender") {
        query.lenderId = user._id;
      } else if (userRole.name === "admin") {
        throw new ApiError(403, "Access denied");
      }

      // Add status filter if provided
      if (status) {
        query.status = status;
      }

      // console.log("Query:", query);

      // Use find() instead of findById() for multiple documents
      const applications = await LoanApplication.find(query)
        .populate("borrowerId", "firstName lastName email")
        .populate("lenderId", "firstName lastName email")
        .populate("loanOfferId", "title interestRate")
        .sort({ applicationDate: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      // console.log("Applications:", applications);

      const total = await LoanApplication.countDocuments(query);

      return {
        applications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
        summary: {
          totalApplications: total,
          currentPage: parseInt(page),
          hasNextPage: parseInt(page) < Math.ceil(total / limit),
          hasPrevPage: parseInt(page) > 1,
        },
      };
    } catch (error) {
      console.error("getApplications Error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Error fetching applications: ${error.message}`);
    }
  }
}

export default LoanApplicationServices;
