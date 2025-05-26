// models/LoanOffer.js
import mongoose from "mongoose";

const LoanOfferSchema = new mongoose.Schema({
  lenderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 100,
  },
  description: {
    type: String,
    maxlength: 500,
  },
  minAmount: {
    type: Number,
    required: true,
    min: 1000,
  },
  maxAmount: {
    type: Number,
    required: true,
    min: 1000,
  },
  interestRate: {
    type: Number,
    required: true,
    min: 1,
    max: 50,
  },
  termOptions: [{
    type: Number, // in months
    min: 1,
    max: 360,
  }],
  loanPurpose: [{
    type: String,
    enum: ["personal", "business", "home", "education", "vehicle", "other"],
  }],
  eligibilityCriteria: {
    minCreditScore: {
      type: Number,
      min: 300,
      max: 850,
    },
    maxDebtToIncomeRatio: {
      type: Number,
      min: 0,
      max: 1,
    },
    minMonthlyIncome: {
      type: Number,
      min: 0,
    },
    employmentStatus: [{
      type: String,
      enum: ["employed", "self-employed", "unemployed", "retired", "student"],
    }],
    minEmploymentDuration: {
      type: Number, // in months
      default: 0,
    },
  },
  availableFunds: {
    type: Number,
    required: true,
    min: 0,
  },
  totalOffered: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "paused", "closed", "expired"],
    default: "active",
  },
  autoApproval: {
    type: Boolean,
    default: false,
  },
  expiryDate: {
    type: Date,
  },
  applications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "LoanApplication",
  }],
  totalApplications: {
    type: Number,
    default: 0,
  },
  approvedApplications: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Validate before saving
LoanOfferSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  
  // Validate amount range
  if (this.minAmount > this.maxAmount) {
    throw new Error("Minimum amount cannot be greater than maximum amount");
  }
  
  // Validate available funds
  if (this.availableFunds > this.totalOffered) {
    throw new Error("Available funds cannot exceed total offered amount");
  }
  
  next();
});

const LoanOffer = mongoose.model("LoanOffer", LoanOfferSchema);
export default LoanOffer;

// models/LoanApplication.js
import mongoose from "mongoose";

const LoanApplicationSchema = new mongoose.Schema({
  applicationId: {
    type: String,
    unique: true,
    required: true,
  },
  loanOfferId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LoanOffer",
    required: true,
  },
  borrowerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  lenderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  requestedAmount: {
    type: Number,
    required: true,
  },
  selectedTerm: {
    type: Number, // in months
    required: true,
  },
  purpose: {
    type: String,
    enum: ["personal", "business", "home", "education", "vehicle", "other"],
    required: true,
  },
  purposeDescription: {
    type: String,
    maxlength: 500,
  },
  borrowerInfo: {
    monthlyIncome: Number,
    employmentStatus: String,
    employmentDuration: Number,
    totalDebt: Number,
    creditScore: Number,
    debtToIncomeRatio: Number,
  },
  documents: [{
    documentType: {
      type: String,
      enum: ["id", "income", "employment", "address", "other"],
    },
    documentUrl: String,
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
  }],
  status: {
    type: String,
    enum: ["pending", "under_review", "approved", "rejected", "expired"],
    default: "pending",
  },
  lenderDecision: {
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    comments: String,
    decidedAt: Date,
  },
  adminDecision: {
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    comments: String,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    decidedAt: Date,
  },
  eligibilityCheck: {
    passed: {
      type: Boolean,
      default: false,
    },
    criteria: [{
      name: String,
      required: mongoose.Schema.Types.Mixed,
      actual: mongoose.Schema.Types.Mixed,
      passed: Boolean,
    }],
    checkedAt: Date,
  },
  calculatedEMI: {
    type: Number,
  },
  totalPayableAmount: {
    type: Number,
  },
  interestRate: {
    type: Number,
  },
  applicationDate: {
    type: Date,
    default: Date.now,
  },
  approvalDate: Date,
  rejectionReason: String,
  expiryDate: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    },
  },
});

// Generate application ID and calculate EMI before saving
LoanApplicationSchema.pre("save", function(next) {
  if (this.isNew) {
    this.applicationId = `LA${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  }
  
  // Calculate EMI if all required fields are present
  if (this.requestedAmount && this.interestRate && this.selectedTerm) {
    const principal = this.requestedAmount;
    const monthlyRate = this.interestRate / 100 / 12;
    const term = this.selectedTerm;
    
    if (monthlyRate === 0) {
      this.calculatedEMI = principal / term;
    } else {
      this.calculatedEMI = (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) / 
                          (Math.pow(1 + monthlyRate, term) - 1);
    }
    
    this.totalPayableAmount = this.calculatedEMI * term;
  }
  
  next();
});

const LoanApplication = mongoose.model("LoanApplication", LoanApplicationSchema);
export default LoanApplication;

// models/P2PLoan.js (Updated version of your existing Loan model)
import mongoose from "mongoose";

const P2PLoanSchema = new mongoose.Schema({
  loanId: {
    type: String,
    unique: true,
    required: true,
  },
  applicationId: {
    type: String,
    required: true,
  },
  loanOfferId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LoanOffer",
    required: true,
  },
  borrowerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  lenderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  principalAmount: {
    type: Number,
    required: true,
  },
  interestRate: {
    type: Number,
    required: true,
  },
  termInMonths: {
    type: Number,
    required: true,
  },
  monthlyEMI: {
    type: Number,
    required: true,
  },
  totalPayableAmount: {
    type: Number,
    required: true,
  },
  remainingBalance: {
    type: Number,
    required: true,
  },
  purpose: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "completed", "defaulted", "closed"],
    default: "active",
  },
  disbursementDate: {
    type: Date,
    default: Date.now,
  },
  nextPaymentDate: {
    type: Date,
    required: true,
  },
  lastPaymentDate: Date,
  paymentsCompleted: {
    type: Number,
    default: 0,
  },
  totalPayments: {
    type: Number,
    required: true,
  },
  paymentHistory: [{
    paymentId: String,
    amount: Number,
    principalPaid: Number,
    interestPaid: Number,
    remainingBalance: Number,
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["paid", "overdue", "partial"],
      default: "paid",
    },
    transactionId: String,
  }],
  overdueDays: {
    type: Number,
    default: 0,
  },
  penaltyAmount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Generate loan ID and set next payment date
P2PLoanSchema.pre("save", function(next) {
  if (this.isNew) {
    this.loanId = `LN${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    this.remainingBalance = this.principalAmount;
    this.totalPayments = this.termInMonths;
    
    // Set next payment date to 30 days from disbursement
    this.nextPaymentDate = new Date(this.disbursementDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  
  this.updatedAt = Date.now();
  next();
});

const P2PLoan = mongoose.model("P2PLoan", P2PLoanSchema);
export default P2PLoan;

// controllers/loanOfferController.js
import LoanOffer from "../models/LoanOffer.js";
import User from "../models/User.js";
import LenderProfile from "../models/LenderProfile.js";

class LoanOfferController {
  // Create loan offer (LENDER only)
  static async createLoanOffer(req, res) {
    try {
      const {
        title,
        description,
        minAmount,
        maxAmount,
        interestRate,
        termOptions,
        loanPurpose,
        eligibilityCriteria,
        totalOffered,
        autoApproval,
        expiryDate
      } = req.body;

      // Verify lender profile and available funds
      const lender = await User.findById(req.user.id);
      const lenderProfile = await LenderProfile.findOne({ roleId: lender.roleId });

      if (!lenderProfile) {
        return res.status(400).json({
          success: false,
          message: "Lender profile not found",
        });
      }

      if (lenderProfile.availableFunds < totalOffered) {
        return res.status(400).json({
          success: false,
          message: "Insufficient available funds",
        });
      }

      const loanOffer = new LoanOffer({
        lenderId: req.user.id,
        title,
        description,
        minAmount,
        maxAmount,
        interestRate,
        termOptions,
        loanPurpose,
        eligibilityCriteria,
        totalOffered,
        availableFunds: totalOffered,
        autoApproval,
        expiryDate,
      });

      await loanOffer.save();

      // Update lender's available funds
      lenderProfile.availableFunds -= totalOffered;
      await lenderProfile.save();

      res.status(201).json({
        success: true,
        message: "Loan offer created successfully",
        data: loanOffer,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error creating loan offer",
        error: error.message,
      });
    }
  }

  // Get all active loan offers
  static async getAllLoanOffers(req, res) {
    try {
      const { 
        minAmount, 
        maxAmount, 
        maxInterestRate, 
        purpose, 
        term,
        page = 1, 
        limit = 10 
      } = req.query;

      let query = { status: "active" };

      // Apply filters
      if (minAmount) query.minAmount = { $lte: minAmount };
      if (maxAmount) query.maxAmount = { $gte: maxAmount };
      if (maxInterestRate) query.interestRate = { $lte: maxInterestRate };
      if (purpose) query.loanPurpose = { $in: [purpose] };
      if (term) query.termOptions = { $in: [parseInt(term)] };

      const offers = await LoanOffer.find(query)
        .populate("lenderId", "firstName lastName email profileImage")
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await LoanOffer.countDocuments(query);

      res.json({
        success: true,
        data: {
          offers,
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
        message: "Error fetching loan offers",
        error: error.message,
      });
    }
  }

  // Get loan offer details
  static async getLoanOfferDetails(req, res) {
    try {
      const { offerId } = req.params;

      const offer = await LoanOffer.findById(offerId)
        .populate("lenderId", "firstName lastName email profileImage")
        .populate({
          path: "applications",
          populate: {
            path: "borrowerId",
            select: "firstName lastName"
          }
        });

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "Loan offer not found",
        });
      }

      res.json({
        success: true,
        data: offer,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching loan offer details",
        error: error.message,
      });
    }
  }

  // Update loan offer (LENDER only)
  static async updateLoanOffer(req, res) {
    try {
      const { offerId } = req.params;
      const updateData = req.body;

      const offer = await LoanOffer.findOne({ 
        _id: offerId, 
        lenderId: req.user.id 
      });

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "Loan offer not found",
        });
      }

      Object.assign(offer, updateData);
      await offer.save();

      res.json({
        success: true,
        message: "Loan offer updated successfully",
        data: offer,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error updating loan offer",
        error: error.message,
      });
    }
  }

  // Get lender's own offers
  static async getLenderOffers(req, res) {
    try {
      const { status, page = 1, limit = 10 } = req.query;

      let query = { lenderId: req.user.id };
      if (status) query.status = status;

      const offers = await LoanOffer.find(query)
        .populate("applications")
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await LoanOffer.countDocuments(query);

      res.json({
        success: true,
        data: {
          offers,
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
        message: "Error fetching lender offers",
        error: error.message,
      });
    }
  }
}

export default LoanOfferController;

// controllers/loanApplicationController.js
import LoanApplication from "../models/LoanApplication.js";
import LoanOffer from "../models/LoanOffer.js";
import BorrowerProfile from "../models/BorrowerProfile.js";
import User from "../models/User.js";

class LoanApplicationController {
  // Apply for loan (BORROWER only)
  static async applyForLoan(req, res) {
    try {
      const { offerId } = req.params;
      const {
        requestedAmount,
        selectedTerm,
        purpose,
        purposeDescription,
      } = req.body;

      // Get loan offer
      const loanOffer = await LoanOffer.findById(offerId);
      if (!loanOffer || loanOffer.status !== "active") {
        return res.status(404).json({
          success: false,
          message: "Loan offer not found or inactive",
        });
      }

      // Check if borrower already applied for this offer
      const existingApplication = await LoanApplication.findOne({
        loanOfferId: offerId,
        borrowerId: req.user.id,
        status: { $in: ["pending", "under_review", "approved"] }
      });

      if (existingApplication) {
        return res.status(400).json({
          success: false,
          message: "You have already applied for this loan offer",
        });
      }

      // Get borrower profile
      const borrower = await User.findById(req.user.id);
      const borrowerProfile = await BorrowerProfile.findOne({ roleId: borrower.roleId });

      if (!borrowerProfile) {
        return res.status(400).json({
          success: false,
          message: "Borrower profile not found",
        });
      }

      // Validate request amount
      if (requestedAmount < loanOffer.minAmount || requestedAmount > loanOffer.maxAmount) {
        return res.status(400).json({
          success: false,
          message: `Requested amount must be between ${loanOffer.minAmount} and ${loanOffer.maxAmount}`,
        });
      }

      // Check available funds
      if (requestedAmount > loanOffer.availableFunds) {
        return res.status(400).json({
          success: false,
          message: "Insufficient funds available in this offer",
        });
      }

      // Validate term
      if (!loanOffer.termOptions.includes(selectedTerm)) {
        return res.status(400).json({
          success: false,
          message: "Selected term is not available for this offer",
        });
      }

      // Check eligibility
      const eligibilityResult = await this.checkEligibility(borrowerProfile, loanOffer.eligibilityCriteria);

      const application = new LoanApplication({
        loanOfferId: offerId,
        borrowerId: req.user.id,
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
        rejectionReason: eligibilityResult.passed ? null : "Does not meet eligibility criteria",
      });

      await application.save();

      // Update loan offer
      loanOffer.applications.push(application._id);
      loanOffer.totalApplications += 1;
      await loanOffer.save();

      res.status(201).json({
        success: true,
        message: "Loan application submitted successfully",
        data: {
          applicationId: application.applicationId,
          status: application.status,
          eligibilityPassed: eligibilityResult.passed,
          calculatedEMI: application.calculatedEMI,
          totalPayableAmount: application.totalPayableAmount,
        },
      });
    } catch (error) {
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
      const creditPassed = borrowerProfile.creditScore >= criteria.minCreditScore;
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
      const debtRatioPassed = borrowerProfile.debtToIncomeRatio <= criteria.maxDebtToIncomeRatio;
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
      const incomePassed = borrowerProfile.monthlyIncome >= criteria.minMonthlyIncome;
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
      const employmentPassed = criteria.employmentStatus.includes(borrowerProfile.employmentStatus);
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
      const durationPassed = borrowerProfile.employmentDuration >= criteria.minEmploymentDuration;
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
        status: "pending"
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
        status: "under_review"
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

// controllers/p2pLoanController.js
import P2PLoan from "../models/P2PLoan.js";
import LoanApplication from "../models/LoanApplication.js";
import User from "../models/User.js";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";

class P2PLoanController {
  // Disburse loan after approval (ADMIN only)
  static async disburseLoan(req, res) {
    try {
      const { applicationId, borrowerAccountId } = req.body;

      const application = await LoanApplication.findOne({
        applicationId,
        status: "approved"
      }).populate("loanOfferId").populate("borrowerId").populate("lenderId");

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Approved application not found",
        });
      }

      // Verify accounts
      const borrowerAccount = await Account.findOne({
        accountId: borrowerAccountId,
        userId: application.borrowerId._id,
        status: "ACTIVE"
      });

      const lenderAccount = await Account.findOne({
        userId: application.lenderId._id,
        status: "ACTIVE"
      });

      if (!borrowerAccount || !lenderAccount) {
        return res.status(404).json({
          success: false,
          message: "Valid accounts not found",
        });