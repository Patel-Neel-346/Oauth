// import LoanApplication from "../../models/Loan/LoanApplication.js";
// import LoanOffer from "../../models/Loan/LoanOffer.js";
// import BorrowerProfile from "../../models/BorrowerProfile.js";
// import User from "../../models/User.js";
// import Role from "../../models/Role.js";

// class LoanApplicationService {
//   static async checkEligibility(borrowerProfile, criteria) {
//     const checks = [];
//     let allPassed = true;

//     if (criteria.minCreditScore) {
//       const creditPassed =
//         borrowerProfile.creditScore >= criteria.minCreditScore;
//       checks.push({
//         name: "Credit Score",
//         required: criteria.minCreditScore,
//         actual: borrowerProfile.creditScore,
//         passed: creditPassed,
//       });
//       if (!creditPassed) allPassed = false;
//     }

//     if (criteria.maxDebtToIncomeRatio) {
//       const debtRatioPassed =
//         borrowerProfile.debtToIncomeRatio <= criteria.maxDebtToIncomeRatio;
//       checks.push({
//         name: "Debt to Income Ratio",
//         required: `≤ ${criteria.maxDebtToIncomeRatio}`,
//         actual: borrowerProfile.debtToIncomeRatio,
//         passed: debtRatioPassed,
//       });
//       if (!debtRatioPassed) allPassed = false;
//     }

//     if (criteria.minMonthlyIncome) {
//       const incomePassed =
//         borrowerProfile.monthlyIncome >= criteria.minMonthlyIncome;
//       checks.push({
//         name: "Monthly Income",
//         required: criteria.minMonthlyIncome,
//         actual: borrowerProfile.monthlyIncome,
//         passed: incomePassed,
//       });
//       if (!incomePassed) allPassed = false;
//     }

//     if (criteria.employmentStatus?.length) {
//       const employmentPassed = criteria.employmentStatus.includes(
//         borrowerProfile.employmentStatus
//       );
//       checks.push({
//         name: "Employment Status",
//         required: criteria.employmentStatus.join(", "),
//         actual: borrowerProfile.employmentStatus,
//         passed: employmentPassed,
//       });
//       if (!employmentPassed) allPassed = false;
//     }

//     if (criteria.minEmploymentDuration) {
//       const durationPassed =
//         borrowerProfile.employmentDuration >= criteria.minEmploymentDuration;
//       checks.push({
//         name: "Employment Duration (months)",
//         required: criteria.minEmploymentDuration,
//         actual: borrowerProfile.employmentDuration,
//         passed: durationPassed,
//       });
//       if (!durationPassed) allPassed = false;
//     }

//     return { passed: allPassed, criteria: checks, checkedAt: new Date() };
//   }

//   static async applyForLoan(req) {
//     const { offerId } = req.params;
//     const { requestedAmount, selectedTerm, purpose, purposeDescription } =
//       req.body;

//     const loanOffer = await LoanOffer.findById(offerId);
//     if (!loanOffer || loanOffer.status !== "active")
//       throw new Error("Loan offer not found or inactive");

//     const existing = await LoanApplication.findOne({
//       loanOfferId: offerId,
//       borrowerId: req.user.id,
//       status: { $in: ["pending", "under_review", "approved"] },
//     });
//     if (existing)
//       throw new Error("You have already applied for this loan offer");

//     const user = await User.findById(req.user);
//     const borrowerRole = await Role.findOne({
//       name: "borrower",
//       users: user._id,
//     });
//     const borrowerProfile = await BorrowerProfile.findOne({
//       roleId: borrowerRole._id,
//     });

//     if (!borrowerProfile) throw new Error("Borrower profile not found");

//     if (
//       requestedAmount < loanOffer.minAmount ||
//       requestedAmount > loanOffer.maxAmount
//     )
//       throw new Error(
//         `Requested amount must be between ${loanOffer.minAmount} and ${loanOffer.maxAmount}`
//       );

//     if (requestedAmount > loanOffer.availableFunds)
//       throw new Error("Insufficient funds available in this offer");

//     if (!loanOffer.termOptions.includes(selectedTerm))
//       throw new Error("Selected term is not available for this offer");

//     const eligibilityResult = await LoanApplicationService.checkEligibility(
//       borrowerProfile,
//       loanOffer.eligibilityCriteria
//     );

//     const application = new LoanApplication({
//       loanOfferId: offerId,
//       borrowerId: user._id,
//       lenderId: loanOffer.lenderId,
//       requestedAmount,
//       selectedTerm,
//       purpose,
//       purposeDescription,
//       interestRate: loanOffer.interestRate,
//       borrowerInfo: {
//         monthlyIncome: borrowerProfile.monthlyIncome,
//         employmentStatus: borrowerProfile.employmentStatus,
//         employmentDuration: borrowerProfile.employmentDuration,
//         totalDebt: borrowerProfile.totalDebt,
//         creditScore: borrowerProfile.creditScore,
//         debtToIncomeRatio: borrowerProfile.debtToIncomeRatio,
//       },
//       eligibilityCheck: eligibilityResult,
//       status: eligibilityResult.passed ? "pending" : "rejected",
//       rejectionReason: eligibilityResult.passed
//         ? null
//         : "Does not meet eligibility criteria",
//     });

//     await application.save();
//     loanOffer.applications.push(application._id);
//     loanOffer.totalApplications += 1;
//     await loanOffer.save();

//     return {
//       applicationId: application._id,
//       status: application.status,
//       eligibilityPassed: eligibilityResult.passed,
//       calculatedEMI: application.calculatedEMI,
//       totalPayableAmount: application.totalPayableAmount,
//     };
//   }

//   static async lenderReviewApplication(req) {
//     const { applicationId } = req.params;
//     const { decision, comments } = req.body;

//     const application = await LoanApplication.findOne({
//       applicationId,
//       lenderId: req.user.id,
//       status: "pending",
//     });

//     if (!application)
//       throw new Error("Application not found or already reviewed");

//     application.lenderDecision = {
//       status: decision,
//       comments,
//       decidedAt: new Date(),
//     };

//     application.status = decision === "approved" ? "under_review" : "rejected";
//     await application.save();

//     return { applicationId, status: application.status };
//   }

//   static async adminFinalApproval(req) {
//     const { applicationId } = req.params;
//     const { decision, comments } = req.body;

//     const application = await LoanApplication.findOne({
//       applicationId,
//       status: "under_review",
//     }).populate("loanOfferId");

//     if (!application)
//       throw new Error("Application not found or not ready for final approval");

//     application.adminDecision = {
//       status: decision,
//       comments,
//       reviewedBy: req.user.id,
//       decidedAt: new Date(),
//     };

//     if (decision === "approved") {
//       application.status = "approved";
//       application.approvalDate = new Date();
//       const loanOffer = application.loanOfferId;
//       loanOffer.availableFunds -= application.requestedAmount;
//       loanOffer.approvedApplications += 1;
//       await loanOffer.save();
//     } else {
//       application.status = "rejected";
//     }

//     await application.save();
//     return { applicationId, status: application.status };
//   }

//   static async getApplications(req) {
//     const { status, page = 1, limit = 10 } = req.query;
//     const user = await User.findById(req.user.id);
//     const query = {};

//     if (user.roles.includes("BORROWER")) {
//       query.borrowerId = req.user.id;
//     } else if (user.roles.includes("LENDER")) {
//       query.lenderId = req.user.id;
//     }

//     if (status) query.status = status;

//     const applications = await LoanApplication.find(query)
//       .populate("borrowerId", "firstName lastName email")
//       .populate("lenderId", "firstName lastName email")
//       .populate("loanOfferId", "title interestRate")
//       .sort({ applicationDate: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit);

//     const total = await LoanApplication.countDocuments(query);
//     return {
//       applications,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit),
//       },
//     };
//   }
// }

// export default LoanApplicationService;
