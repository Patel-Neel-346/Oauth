import LoanApplication from "../../models/Loan/LoanApplication.js";
import LoanOffer from "../../models/Loan/LoanOffer.js";
import BorrowerProfile from "../../models/BorrowerProfile.js";
import User from "../../models/User.js";
import Role from "../../models/Role.js";

class LoanApplicationController {
  static async checkEligibility(borrowerProfile, criteria) {
    const checks = [];
    let allPassed = true;

    // Credit score check
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

    // Debt to income ratio check
    if (criteria.maxDebtToIncomeRatio) {
      const debtRatioPassed =
        borrowerProfile.debtToIncomeRatio <= criteria.maxDebtToIncomeRatio;
      checks.push({
        name: "Debt to Income Ratio",
        required: `≤ ${criteria.maxDebtToIncomeRatio}`,
        actual: borrowerProfile.debtToIncomeRatio,
        passed: debtRatioPassed,
      });
      if (!debtRatioPassed) allPassed = false;
    }

    // Monthly income check
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

    // Employment status check
    if (criteria.employmentStatus && criteria.employmentStatus.length > 0) {
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

    // Employment duration check
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

    return {
      passed: allPassed,
      criteria: checks,
      checkedAt: new Date(),
    };
  }
  // Apply for loan (BORROWER only)
  static async applyForLoan(req, res) {
    try {
      const { offerId } = req.params;
      const { requestedAmount, selectedTerm, purpose, purposeDescription } =
        req.body;

      // Step 1: Get the loan offer
      const loanOffer = await LoanOffer.findById(offerId);
      if (!loanOffer || loanOffer.status !== "active") {
        return res.status(404).json({
          success: false,
          message: "Loan offer not found or inactive",
        });
      }

      // Step 2: Check if borrower already applied
      const existingApplication = await LoanApplication.findOne({
        loanOfferId: offerId,
        borrowerId: req.user.id,
        status: { $in: ["pending", "under_review", "approved"] },
      });

      if (existingApplication) {
        return res.status(400).json({
          success: false,
          message: "You have already applied for this loan offer",
        });
      }

      // Step 3: Get borrower
      const user = await User.findById(req.user);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      console.log(user);
      // Step 4: Get borrower role that includes this user
      const borrowerRole = await Role.findOne({
        name: "borrower",
        users: user._id,
      });
      //   console.log(borrowerProfile);
      if (!borrowerRole) {
        return res.status(400).json({
          success: false,
          message: "Borrower role not assigned to user",
        });
      }

      // Step 5: Get BorrowerProfile using roleId
      const borrowerProfile = await BorrowerProfile.findOne({
        roleId: borrowerRole._id,
      });

      if (!borrowerProfile) {
        return res.status(400).json({
          success: false,
          message: "Borrower profile not found",
        });
      }

      // Step 6: Validate requested amount
      if (
        requestedAmount < loanOffer.minAmount ||
        requestedAmount > loanOffer.maxAmount
      ) {
        return res.status(400).json({
          success: false,
          message: `Requested amount must be between ${loanOffer.minAmount} and ${loanOffer.maxAmount}`,
        });
      }

      // Step 7: Check available funds
      if (requestedAmount > loanOffer.availableFunds) {
        return res.status(400).json({
          success: false,
          message: "Insufficient funds available in this offer",
        });
      }

      // Step 8: Validate term
      if (!loanOffer.termOptions.includes(selectedTerm)) {
        return res.status(400).json({
          success: false,
          message: "Selected term is not available for this offer",
        });
      }

      // Step 9: Check eligibility
      const eligibilityResult =
        await LoanApplicationController.checkEligibility(
          borrowerProfile,
          loanOffer.eligibilityCriteria
        );
      console.log(eligibilityResult);

      // Step 10: Create application
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
          totalDebt: borrowerProfile.totalDebt,
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
      console.log(application);

      // Step 11: Update loan offer
      loanOffer.applications.push(application._id);
      loanOffer.totalApplications += 1;
      await loanOffer.save();

      // Step 12: Respond
      res.status(201).json({
        success: true,
        message: "Loan application submitted successfully",
        data: {
          applicationId: application._id,
          status: application.status,
          eligibilityPassed: eligibilityResult.passed,
          calculatedEMI: application.calculatedEMI,
          totalPayableAmount: application.totalPayableAmount,
        },
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        success: false,
        message: "Error submitting loan application",
        error: error.message,
      });
    }
  }

  // Check borrower eligibility
  static async checkEligibility(borrowerProfile, criteria) {
    const checks = [];
    let allPassed = true;

    // Credit score check
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

    // Debt to income ratio check
    if (criteria.maxDebtToIncomeRatio) {
      const debtRatioPassed =
        borrowerProfile.debtToIncomeRatio <= criteria.maxDebtToIncomeRatio;
      checks.push({
        name: "Debt to Income Ratio",
        required: `≤ ${criteria.maxDebtToIncomeRatio}`,
        actual: borrowerProfile.debtToIncomeRatio,
        passed: debtRatioPassed,
      });
      if (!debtRatioPassed) allPassed = false;
    }

    // Monthly income check
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

    // Employment status check
    if (criteria.employmentStatus && criteria.employmentStatus.length > 0) {
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

    // Employment duration check
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

    return {
      passed: allPassed,
      criteria: checks,
      checkedAt: new Date(),
    };
  }

  // Lender review application
  static async lenderReviewApplication(req, res) {
    try {
      const { applicationId } = req.params;
      const { decision, comments } = req.body; // 'approved' or 'rejected'

      const application = await LoanApplication.findOne({
        applicationId,
        lenderId: req.user.id,
        status: "pending",
      });

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Application not found or already reviewed",
        });
      }

      application.lenderDecision = {
        status: decision,
        comments,
        decidedAt: new Date(),
      };

      if (decision === "approved") {
        application.status = "under_review"; // Now goes to admin
      } else {
        application.status = "rejected";
      }

      await application.save();

      res.json({
        success: true,
        message: `Application ${decision} successfully`,
        data: {
          applicationId: application.applicationId,
          status: application.status,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error reviewing application",
        error: error.message,
      });
    }
  }

  // Admin final approval
  static async adminFinalApproval(req, res) {
    try {
      const { applicationId } = req.params;
      const { decision, comments } = req.body; // 'approved' or 'rejected'

      const application = await LoanApplication.findOne({
        applicationId,
        status: "under_review",
      }).populate("loanOfferId");

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Application not found or not ready for final approval",
        });
      }

      application.adminDecision = {
        status: decision,
        comments,
        reviewedBy: req.user.id,
        decidedAt: new Date(),
      };

      if (decision === "approved") {
        application.status = "approved";
        application.approvalDate = new Date();

        // Update loan offer
        const loanOffer = application.loanOfferId;
        loanOffer.availableFunds -= application.requestedAmount;
        loanOffer.approvedApplications += 1;
        await loanOffer.save();
      } else {
        application.status = "rejected";
      }

      await application.save();

      res.json({
        success: true,
        message: `Application ${decision} successfully`,
        data: {
          applicationId: application.applicationId,
          status: application.status,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error in final approval",
        error: error.message,
      });
    }
  }

  // Get applications (role-based)
  static async getApplications(req, res) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      let query = {};

      const user = await User.findById(req.user.id);

      // Role-based filtering
      if (user.roles.includes("BORROWER")) {
        query.borrowerId = req.user.id;
      } else if (user.roles.includes("LENDER")) {
        query.lenderId = req.user.id;
      }
      // Admins can see all applications

      if (status) query.status = status;

      const applications = await LoanApplication.find(query)
        .populate("borrowerId", "firstName lastName email")
        .populate("lenderId", "firstName lastName email")
        .populate("loanOfferId", "title interestRate")
        .sort({ applicationDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await LoanApplication.countDocuments(query);

      res.json({
        success: true,
        data: {
          applications,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching applications",
        error: error.message,
      });
    }
  }
}

export default LoanApplicationController;
