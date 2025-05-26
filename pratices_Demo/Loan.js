// models/Loan.js
const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema(
  {
    loanId: {
      type: String,
      unique: true,
      required: true,
    },
    borrowerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    loanType: {
      type: String,
      enum: ["PERSONAL", "HOME", "CAR", "BUSINESS", "EDUCATION"],
      required: true,
    },
    principalAmount: {
      type: Number,
      required: true,
      min: 1000,
    },
    interestRate: {
      type: Number,
      required: true,
      min: 0.01,
      max: 30,
    },
    termInMonths: {
      type: Number,
      required: true,
      min: 6,
      max: 360,
    },
    monthlyPayment: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    remainingBalance: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "ACTIVE",
        "COMPLETED",
        "DEFAULTED",
      ],
      default: "PENDING",
    },
    applicationDate: {
      type: Date,
      default: Date.now,
    },
    approvalDate: Date,
    disbursementDate: Date,
    nextPaymentDate: Date,
    lastPaymentDate: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    collateral: {
      type: String,
      description: String,
      value: Number,
    },
    purpose: {
      type: String,
      required: true,
    },
    employmentInfo: {
      employer: String,
      position: String,
      monthlyIncome: Number,
      workExperience: Number,
    },
    creditScore: {
      type: Number,
      min: 300,
      max: 850,
    },
    documents: [
      {
        type: String,
        url: String,
        uploadDate: Date,
      },
    ],
    paymentHistory: [
      {
        paymentId: String,
        amount: Number,
        principalPaid: Number,
        interestPaid: Number,
        remainingBalance: Number,
        paymentDate: Date,
        status: {
          type: String,
          enum: ["PAID", "LATE", "MISSED"],
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Generate loan ID
loanSchema.pre("save", async function (next) {
  if (!this.loanId) {
    const count = await this.constructor.countDocuments();
    this.loanId = `LN${Date.now()}${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// Calculate monthly payment using PMT formula
loanSchema.methods.calculateMonthlyPayment = function () {
  const r = this.interestRate / 100 / 12; // Monthly interest rate
  const n = this.termInMonths;
  const pv = this.principalAmount;

  if (r === 0) {
    this.monthlyPayment = pv / n;
  } else {
    this.monthlyPayment =
      (pv * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
  }

  this.totalAmount = this.monthlyPayment * n;
  this.remainingBalance = this.principalAmount;
};

module.exports = mongoose.model("Loan", loanSchema);

// controllers/loanController.js
const Loan = require("../models/Loan");
const User = require("../models/User");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const { generateTransactionId } = require("../utils/helpers");

class LoanController {
  // Apply for a loan
  static async applyForLoan(req, res) {
    try {
      const {
        loanType,
        principalAmount,
        termInMonths,
        purpose,
        employmentInfo,
        collateral,
      } = req.body;

      // Verify borrower role and profile
      const borrower = await User.findById(req.user.id);
      if (!borrower.roles.includes("BORROWER")) {
        return res.status(403).json({
          success: false,
          message: "Only borrowers can apply for loans",
        });
      }

      if (!borrower.profileVerified) {
        return res.status(400).json({
          success: false,
          message: "Profile verification required for loan application",
        });
      }

      // Check for existing active loans
      const existingLoan = await Loan.findOne({
        borrowerId: req.user.id,
        status: { $in: ["PENDING", "APPROVED", "ACTIVE"] },
      });

      if (existingLoan) {
        return res.status(400).json({
          success: false,
          message: "You already have an active loan application or loan",
        });
      }

      // Determine interest rate based on loan type and credit score
      const interestRates = {
        PERSONAL: 12.5,
        HOME: 8.5,
        CAR: 10.0,
        BUSINESS: 15.0,
        EDUCATION: 9.5,
      };

      let baseRate = interestRates[loanType];

      // Adjust rate based on credit score
      if (borrower.creditScore) {
        if (borrower.creditScore >= 750) baseRate -= 2;
        else if (borrower.creditScore >= 700) baseRate -= 1;
        else if (borrower.creditScore < 600) baseRate += 3;
      }

      const loan = new Loan({
        borrowerId: req.user.id,
        loanType,
        principalAmount,
        interestRate: baseRate,
        termInMonths,
        purpose,
        employmentInfo,
        collateral,
        creditScore: borrower.creditScore,
      });

      loan.calculateMonthlyPayment();
      await loan.save();

      res.status(201).json({
        success: true,
        message: "Loan application submitted successfully",
        data: {
          loanId: loan.loanId,
          monthlyPayment: loan.monthlyPayment,
          totalAmount: loan.totalAmount,
          interestRate: loan.interestRate,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error applying for loan",
        error: error.message,
      });
    }
  }

  // Review loan application (MANAGER/ADMIN only)
  static async reviewLoanApplication(req, res) {
    try {
      const { loanId } = req.params;
      const { action, comments } = req.body; // action: 'APPROVE' or 'REJECT'

      // Check permissions
      if (!req.user.roles.some((role) => ["MANAGER", "ADMIN"].includes(role))) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions to review loans",
        });
      }

      const loan = await Loan.findOne({ loanId }).populate("borrowerId");
      if (!loan) {
        return res.status(404).json({
          success: false,
          message: "Loan not found",
        });
      }

      if (loan.status !== "PENDING") {
        return res.status(400).json({
          success: false,
          message: "Loan has already been reviewed",
        });
      }

      loan.status = action === "APPROVE" ? "APPROVED" : "REJECTED";
      loan.approvalDate = new Date();
      loan.approvedBy = req.user.id;

      if (action === "APPROVE") {
        // Create loan account for borrower
        const loanAccount = new Account({
          userId: loan.borrowerId._id,
          accountType: "LOAN",
          balance: 0, // Will be updated after disbursement
          status: "ACTIVE",
        });
        await loanAccount.save();
      }

      await loan.save();

      res.json({
        success: true,
        message: `Loan ${action.toLowerCase()}d successfully`,
        data: {
          loanId: loan.loanId,
          status: loan.status,
          approvalDate: loan.approvalDate,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error reviewing loan application",
        error: error.message,
      });
    }
  }

  // Disburse loan (MANAGER/ADMIN only)
  static async disburseLoan(req, res) {
    try {
      const { loanId } = req.params;
      const { accountId } = req.body; // Target account for disbursement

      // Check permissions
      if (!req.user.roles.some((role) => ["MANAGER", "ADMIN"].includes(role))) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions to disburse loans",
        });
      }

      const loan = await Loan.findOne({ loanId }).populate("borrowerId");
      if (!loan || loan.status !== "APPROVED") {
        return res.status(404).json({
          success: false,
          message: "Approved loan not found",
        });
      }

      // Verify target account belongs to borrower
      const targetAccount = await Account.findOne({
        accountId,
        userId: loan.borrowerId._id,
        accountType: { $in: ["SAVINGS", "CHECKING"] },
        status: "ACTIVE",
      });

      if (!targetAccount) {
        return res.status(404).json({
          success: false,
          message: "Valid target account not found",
        });
      }

      // Create disbursement transaction
      const transaction = new Transaction({
        fromAccountId: null, // Bank disbursement
        toAccountId: accountId,
        amount: loan.principalAmount,
        type: "LOAN_DISBURSEMENT",
        description: `Loan disbursement - ${loan.loanId}`,
        reference: loan.loanId,
        processedBy: req.user.id,
      });

      // Update account balance
      targetAccount.balance += loan.principalAmount;

      // Update loan status
      loan.status = "ACTIVE";
      loan.disbursementDate = new Date();
      loan.nextPaymentDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      await Promise.all([
        transaction.save(),
        targetAccount.save(),
        loan.save(),
      ]);

      res.json({
        success: true,
        message: "Loan disbursed successfully",
        data: {
          loanId: loan.loanId,
          disbursedAmount: loan.principalAmount,
          targetAccount: accountId,
          nextPaymentDate: loan.nextPaymentDate,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error disbursing loan",
        error: error.message,
      });
    }
  }

  // Make loan payment
  static async makeLoanPayment(req, res) {
    try {
      const { loanId } = req.params;
      const { accountId, amount } = req.body;

      const loan = await Loan.findOne({
        loanId,
        borrowerId: req.user.id,
        status: "ACTIVE",
      });

      if (!loan) {
        return res.status(404).json({
          success: false,
          message: "Active loan not found",
        });
      }

      // Verify payment account
      const paymentAccount = await Account.findOne({
        accountId,
        userId: req.user.id,
        accountType: { $in: ["SAVINGS", "CHECKING"] },
        status: "ACTIVE",
      });

      if (!paymentAccount || paymentAccount.balance < amount) {
        return res.status(400).json({
          success: false,
          message: "Insufficient funds in payment account",
        });
      }

      // Calculate interest and principal portions
      const monthlyInterest =
        (loan.remainingBalance * loan.interestRate) / 100 / 12;
      const principalPayment = Math.min(
        amount - monthlyInterest,
        loan.remainingBalance
      );
      const interestPayment = amount - principalPayment;

      // Create payment transaction
      const transaction = new Transaction({
        fromAccountId: accountId,
        toAccountId: null, // Bank collection
        amount: amount,
        type: "LOAN_PAYMENT",
        description: `Loan payment - ${loan.loanId}`,
        reference: loan.loanId,
      });

      // Update account balance
      paymentAccount.balance -= amount;

      // Update loan balance and payment history
      loan.remainingBalance -= principalPayment;
      loan.lastPaymentDate = new Date();

      if (loan.remainingBalance <= 0) {
        loan.status = "COMPLETED";
        loan.remainingBalance = 0;
      } else {
        loan.nextPaymentDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      // Add to payment history
      loan.paymentHistory.push({
        paymentId: generateTransactionId(),
        amount: amount,
        principalPaid: principalPayment,
        interestPaid: interestPayment,
        remainingBalance: loan.remainingBalance,
        paymentDate: new Date(),
        status: "PAID",
      });

      await Promise.all([
        transaction.save(),
        paymentAccount.save(),
        loan.save(),
      ]);

      res.json({
        success: true,
        message: "Loan payment processed successfully",
        data: {
          paymentAmount: amount,
          principalPaid: principalPayment,
          interestPaid: interestPayment,
          remainingBalance: loan.remainingBalance,
          nextPaymentDate: loan.nextPaymentDate,
          loanStatus: loan.status,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error processing loan payment",
        error: error.message,
      });
    }
  }

  // Get loan details
  static async getLoanDetails(req, res) {
    try {
      const { loanId } = req.params;

      let query = { loanId };

      // Role-based access control
      if (
        req.user.roles.includes("BORROWER") &&
        !req.user.roles.some((role) => ["MANAGER", "ADMIN"].includes(role))
      ) {
        query.borrowerId = req.user.id;
      }

      const loan = await Loan.findOne(query)
        .populate("borrowerId", "firstName lastName email phoneNumber")
        .populate("approvedBy", "firstName lastName");

      if (!loan) {
        return res.status(404).json({
          success: false,
          message: "Loan not found",
        });
      }

      res.json({
        success: true,
        data: loan,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching loan details",
        error: error.message,
      });
    }
  }

  // Get all loans (with role-based filtering)
  static async getAllLoans(req, res) {
    try {
      const { status, loanType, page = 1, limit = 10 } = req.query;

      let query = {};

      // Role-based filtering
      if (
        req.user.roles.includes("BORROWER") &&
        !req.user.roles.some((role) => ["MANAGER", "ADMIN"].includes(role))
      ) {
        query.borrowerId = req.user.id;
      }

      if (status) query.status = status;
      if (loanType) query.loanType = loanType;

      const loans = await Loan.find(query)
        .populate("borrowerId", "firstName lastName email")
        .populate("approvedBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Loan.countDocuments(query);

      res.json({
        success: true,
        data: {
          loans,
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
        message: "Error fetching loans",
        error: error.message,
      });
    }
  }

  // Calculate loan amortization schedule
  static async getLoanAmortization(req, res) {
    try {
      const { loanId } = req.params;

      const loan = await Loan.findOne({
        loanId,
        $or: [
          { borrowerId: req.user.id },
          {
            $and: [
              { approvedBy: { $exists: true } },
              { "req.user.roles": { $in: ["MANAGER", "ADMIN"] } },
            ],
          },
        ],
      });

      if (!loan) {
        return res.status(404).json({
          success: false,
          message: "Loan not found",
        });
      }

      const schedule = [];
      let balance = loan.principalAmount;
      const monthlyRate = loan.interestRate / 100 / 12;
      const monthlyPayment = loan.monthlyPayment;

      for (let month = 1; month <= loan.termInMonths; month++) {
        const interestPayment = balance * monthlyRate;
        const principalPayment = monthlyPayment - interestPayment;
        balance -= principalPayment;

        schedule.push({
          month,
          payment: monthlyPayment,
          principal: principalPayment,
          interest: interestPayment,
          balance: Math.max(0, balance),
        });

        if (balance <= 0) break;
      }

      res.json({
        success: true,
        data: {
          loanId: loan.loanId,
          totalPayments: schedule.length,
          amortizationSchedule: schedule,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error calculating amortization schedule",
        error: error.message,
      });
    }
  }

  // Loan analytics (MANAGER/ADMIN only)
  static async getLoanAnalytics(req, res) {
    try {
      if (!req.user.roles.some((role) => ["MANAGER", "ADMIN"].includes(role))) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
        });
      }

      const analytics = await Loan.aggregate([
        {
          $group: {
            _id: null,
            totalLoans: { $sum: 1 },
            totalDisbursed: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["ACTIVE", "COMPLETED"]] },
                  "$principalAmount",
                  0,
                ],
              },
            },
            averageLoanAmount: { $avg: "$principalAmount" },
            activeLoans: {
              $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
            },
            pendingLoans: {
              $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
            },
            completedLoans: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
            },
            defaultedLoans: {
              $sum: { $cond: [{ $eq: ["$status", "DEFAULTED"] }, 1, 0] },
            },
          },
        },
      ]);

      const loanTypeStats = await Loan.aggregate([
        {
          $group: {
            _id: "$loanType",
            count: { $sum: 1 },
            totalAmount: { $sum: "$principalAmount" },
            averageAmount: { $avg: "$principalAmount" },
          },
        },
      ]);

      res.json({
        success: true,
        data: {
          overview: analytics[0] || {},
          loanTypeBreakdown: loanTypeStats,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching loan analytics",
        error: error.message,
      });
    }
  }
}

module.exports = LoanController;

// routes/loanRoutes.js
const express = require("express");
const router = express.Router();
const LoanController = require("../controllers/loanController");
const { authenticateToken, authorize } = require("../middleware/auth");
const {
  validateLoanApplication,
  validateLoanReview,
  validateLoanPayment,
} = require("../middleware/validation");

// Apply for loan (BORROWER only)
router.post(
  "/apply",
  authenticateToken,
  authorize(["BORROWER"]),
  validateLoanApplication,
  LoanController.applyForLoan
);

// Review loan application (MANAGER/ADMIN only)
router.put(
  "/:loanId/review",
  authenticateToken,
  authorize(["MANAGER", "ADMIN"]),
  validateLoanReview,
  LoanController.reviewLoanApplication
);

// Disburse loan (MANAGER/ADMIN only)
router.post(
  "/:loanId/disburse",
  authenticateToken,
  authorize(["MANAGER", "ADMIN"]),
  LoanController.disburseLoan
);

// Make loan payment (BORROWER)
router.post(
  "/:loanId/payment",
  authenticateToken,
  authorize(["BORROWER"]),
  validateLoanPayment,
  LoanController.makeLoanPayment
);

// Get loan details
router.get(
  "/:loanId",
  authenticateToken,
  authorize(["BORROWER", "MANAGER", "ADMIN"]),
  LoanController.getLoanDetails
);

// Get all loans (role-based filtering)
router.get(
  "/",
  authenticateToken,
  authorize(["BORROWER", "MANAGER", "ADMIN"]),
  LoanController.getAllLoans
);

// Get loan amortization schedule
router.get(
  "/:loanId/amortization",
  authenticateToken,
  authorize(["BORROWER", "MANAGER", "ADMIN"]),
  LoanController.getLoanAmortization
);

// Get loan analytics (MANAGER/ADMIN only)
router.get(
  "/analytics/overview",
  authenticateToken,
  authorize(["MANAGER", "ADMIN"]),
  LoanController.getLoanAnalytics
);

module.exports = router;

// middleware/validation.js (additional validators)
const { body, validationResult } = require("express-validator");

const validateLoanApplication = [
  body("loanType")
    .isIn(["PERSONAL", "HOME", "CAR", "BUSINESS", "EDUCATION"])
    .withMessage("Invalid loan type"),
  body("principalAmount")
    .isFloat({ min: 1000, max: 10000000 })
    .withMessage("Principal amount must be between $1,000 and $10,000,000"),
  body("termInMonths")
    .isInt({ min: 6, max: 360 })
    .withMessage("Loan term must be between 6 and 360 months"),
  body("purpose")
    .isLength({ min: 10, max: 500 })
    .withMessage("Purpose must be between 10 and 500 characters"),
  body("employmentInfo.employer")
    .notEmpty()
    .withMessage("Employer information is required"),
  body("employmentInfo.monthlyIncome")
    .isFloat({ min: 1000 })
    .withMessage("Monthly income must be at least $1,000"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateLoanReview = [
  body("action")
    .isIn(["APPROVE", "REJECT"])
    .withMessage("Action must be either APPROVE or REJECT"),
  body("comments")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Comments cannot exceed 1000 characters"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateLoanPayment = [
  body("accountId").notEmpty().withMessage("Payment account ID is required"),
  body("amount")
    .isFloat({ min: 1 })
    .withMessage("Payment amount must be greater than 0"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

module.exports = {
  validateLoanApplication,
  validateLoanReview,
  validateLoanPayment,
};

// utils/loanHelpers.js
class LoanHelpers {
  // Calculate EMI using PMT formula
  static calculateEMI(principal, annualRate, termInMonths) {
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) {
      return principal / termInMonths;
    }

    const emi =
      (principal * (monthlyRate * Math.pow(1 + monthlyRate, termInMonths))) /
      (Math.pow(1 + monthlyRate, termInMonths) - 1);
    return Math.round(emi * 100) / 100;
  }

  // Calculate total interest
  static calculateTotalInterest(principal, emi, termInMonths) {
    return emi * termInMonths - principal;
  }

  // Determine loan eligibility
  static assessLoanEligibility(monthlyIncome, existingEMI, requestedEMI) {
    const totalEMI = existingEMI + requestedEMI;
    const emiRatio = (totalEMI / monthlyIncome) * 100;

    if (emiRatio <= 40) {
      return { eligible: true, ratio: emiRatio, risk: "LOW" };
    } else if (emiRatio <= 60) {
      return { eligible: true, ratio: emiRatio, risk: "MEDIUM" };
    } else {
      return { eligible: false, ratio: emiRatio, risk: "HIGH" };
    }
  }

  // Generate payment schedule
  static generatePaymentSchedule(
    principal,
    annualRate,
    termInMonths,
    startDate = new Date()
  ) {
    const monthlyRate = annualRate / 100 / 12;
    const emi = this.calculateEMI(principal, annualRate, termInMonths);

    const schedule = [];
    let remainingPrincipal = principal;
    let currentDate = new Date(startDate);

    for (
      let month = 1;
      month <= termInMonths && remainingPrincipal > 0;
      month++
    ) {
      const interestComponent = remainingPrincipal * monthlyRate;
      const principalComponent = Math.min(
        emi - interestComponent,
        remainingPrincipal
      );
      remainingPrincipal -= principalComponent;

      schedule.push({
        installmentNumber: month,
        dueDate: new Date(currentDate),
        emiAmount: emi,
        principalComponent: Math.round(principalComponent * 100) / 100,
        interestComponent: Math.round(interestComponent * 100) / 100,
        remainingPrincipal: Math.round(remainingPrincipal * 100) / 100,
      });

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return schedule;
  }

  // Check for overdue payments
  static checkOverduePayments(loan) {
    if (loan.status !== "ACTIVE" || !loan.nextPaymentDate) {
      return { isOverdue: false, daysPastDue: 0 };
    }

    const today = new Date();
    const nextPayment = new Date(loan.nextPaymentDate);

    if (today > nextPayment) {
      const daysPastDue = Math.ceil(
        (today - nextPayment) / (1000 * 60 * 60 * 24)
      );
      return { isOverdue: true, daysPastDue };
    }

    return { isOverdue: false, daysPastDue: 0 };
  }
}

module.exports = LoanHelpers;

// Add to app.js
const loanRoutes = require("./routes/loanRoutes");
app.use("/api/loans", loanRoutes);

// Cron job for checking overdue payments (optional)
const cron = require("node-cron");
const Loan = require("./models/Loan");

// Run daily at 9 AM to check for overdue payments
cron.schedule("0 9 * * *", async () => {
  try {
    const overdueLoans = await Loan.find({
      status: "ACTIVE",
      nextPaymentDate: { $lt: new Date() },
    }).populate("borrowerId");

    for (const loan of overdueLoans) {
      const daysPastDue = Math.ceil(
        (new Date() - loan.nextPaymentDate) / (1000 * 60 * 60 * 24)
      );

      // Mark as defaulted after 90 days
      if (daysPastDue >= 90) {
        loan.status = "DEFAULTED";
        await loan.save();

        // Notify admin/manager
        console.log(
          `Loan ${loan.loanId} marked as defaulted - ${daysPastDue} days overdue`
        );
      }

      // Send reminder notifications (implement your notification system)
      console.log(
        `Payment overdue for loan ${loan.loanId} - ${daysPastDue} days`
      );
    }
  } catch (error) {
    console.error("Error checking overdue payments:", error);
  }
});

// services/NotificationService.js
class NotificationService {
  // Send loan application notifications
  static async sendLoanApplicationNotification(loan, borrower) {
    try {
      // Email notification to borrower
      const emailData = {
        to: borrower.email,
        subject: "Loan Application Received",
        template: "loan-application-received",
        data: {
          name: `${borrower.firstName} ${borrower.lastName}`,
          loanId: loan.loanId,
          amount: loan.principalAmount,
          loanType: loan.loanType,
        },
      };

      // Implement your email service here
      console.log("Loan application notification sent:", emailData);

      // SMS notification (optional)
      if (borrower.phoneNumber) {
        const smsData = {
          to: borrower.phoneNumber,
          message: `Your loan application ${loan.loanId} for ${loan.principalAmount} has been received and is under review.`,
        };
        console.log("SMS notification sent:", smsData);
      }
    } catch (error) {
      console.error("Error sending loan application notification:", error);
    }
  }

  // Send loan approval/rejection notifications
  static async sendLoanDecisionNotification(loan, borrower, decision) {
    try {
      const emailData = {
        to: borrower.email,
        subject: `Loan Application ${decision}`,
        template: `loan-${decision.toLowerCase()}`,
        data: {
          name: `${borrower.firstName} ${borrower.lastName}`,
          loanId: loan.loanId,
          amount: loan.principalAmount,
          monthlyPayment: loan.monthlyPayment,
          interestRate: loan.interestRate,
        },
      };

      console.log("Loan decision notification sent:", emailData);
    } catch (error) {
      console.error("Error sending loan decision notification:", error);
    }
  }

  // Send payment reminder notifications
  static async sendPaymentReminder(loan, borrower, daysPastDue = 0) {
    try {
      const subject =
        daysPastDue > 0 ? "Overdue Loan Payment" : "Loan Payment Reminder";
      const urgency = daysPastDue > 0 ? "URGENT" : "REMINDER";

      const emailData = {
        to: borrower.email,
        subject: subject,
        template: "payment-reminder",
        data: {
          name: `${borrower.firstName} ${borrower.lastName}`,
          loanId: loan.loanId,
          monthlyPayment: loan.monthlyPayment,
          nextPaymentDate: loan.nextPaymentDate,
          daysPastDue: daysPastDue,
          urgency: urgency,
          remainingBalance: loan.remainingBalance,
        },
      };

      console.log("Payment reminder sent:", emailData);
    } catch (error) {
      console.error("Error sending payment reminder:", error);
    }
  }
}

module.exports = NotificationService;

// controllers/loanReportsController.js
const Loan = require("../models/Loan");
const User = require("../models/User");

class LoanReportsController {
  // Loan portfolio summary
  static async getPortfolioSummary(req, res) {
    try {
      if (!req.user.roles.some((role) => ["MANAGER", "ADMIN"].includes(role))) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
        });
      }

      const summary = await Loan.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$principalAmount" },
            totalOutstanding: { $sum: "$remainingBalance" },
          },
        },
      ]);

      const monthlyDisbursements = await Loan.aggregate([
        {
          $match: {
            disbursementDate: { $exists: true },
            disbursementDate: {
              $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$disbursementDate" },
              month: { $month: "$disbursementDate" },
            },
            count: { $sum: 1 },
            amount: { $sum: "$principalAmount" },
          },
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
      ]);

      res.json({
        success: true,
        data: {
          portfolioSummary: summary,
          monthlyDisbursements: monthlyDisbursements,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error generating portfolio summary",
        error: error.message,
      });
    }
  }

  // Delinquency report
  static async getDelinquencyReport(req, res) {
    try {
      if (!req.user.roles.some((role) => ["MANAGER", "ADMIN"].includes(role))) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
        });
      }

      const currentDate = new Date();

      const delinquencyReport = await Loan.aggregate([
        {
          $match: {
            status: "ACTIVE",
            nextPaymentDate: { $lt: currentDate },
          },
        },
        {
          $addFields: {
            daysPastDue: {
              $divide: [
                { $subtract: [currentDate, "$nextPaymentDate"] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
        {
          $addFields: {
            delinquencyBucket: {
              $switch: {
                branches: [
                  { case: { $lte: ["$daysPastDue", 30] }, then: "1-30 days" },
                  { case: { $lte: ["$daysPastDue", 60] }, then: "31-60 days" },
                  { case: { $lte: ["$daysPastDue", 90] }, then: "61-90 days" },
                  { case: { $gt: ["$daysPastDue", 90] }, then: "90+ days" },
                ],
                default: "Current",
              },
            },
          },
        },
        {
          $group: {
            _id: "$delinquencyBucket",
            count: { $sum: 1 },
            totalOutstanding: { $sum: "$remainingBalance" },
          },
        },
      ]);

      res.json({
        success: true,
        data: {
          delinquencyReport,
          generatedAt: currentDate,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error generating delinquency report",
        error: error.message,
      });
    }
  }

  // Loan performance metrics
  static async getPerformanceMetrics(req, res) {
    try {
      if (!req.user.roles.some((role) => ["MANAGER", "ADMIN"].includes(role))) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
        });
      }

      const metrics = await Loan.aggregate([
        {
          $facet: {
            approvalRate: [
              {
                $group: {
                  _id: null,
                  totalApplications: { $sum: 1 },
                  approvedApplications: {
                    $sum: {
                      $cond: [
                        {
                          $in: ["$status", ["APPROVED", "ACTIVE", "COMPLETED"]],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
              {
                $addFields: {
                  approvalRate: {
                    $multiply: [
                      {
                        $divide: [
                          "$approvedApplications",
                          "$totalApplications",
                        ],
                      },
                      100,
                    ],
                  },
                },
              },
            ],
            averageProcessingTime: [
              {
                $match: {
                  approvalDate: { $exists: true },
                },
              },
              {
                $addFields: {
                  processingDays: {
                    $divide: [
                      { $subtract: ["$approvalDate", "$applicationDate"] },
                      1000 * 60 * 60 * 24,
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  averageProcessingDays: { $avg: "$processingDays" },
                },
              },
            ],
            defaultRate: [
              {
                $match: {
                  status: { $in: ["ACTIVE", "COMPLETED", "DEFAULTED"] },
                },
              },
              {
                $group: {
                  _id: null,
                  totalLoans: { $sum: 1 },
                  defaultedLoans: {
                    $sum: { $cond: [{ $eq: ["$status", "DEFAULTED"] }, 1, 0] },
                  },
                },
              },
              {
                $addFields: {
                  defaultRate: {
                    $multiply: [
                      { $divide: ["$defaultedLoans", "$totalLoans"] },
                      100,
                    ],
                  },
                },
              },
            ],
          },
        },
      ]);

      res.json({
        success: true,
        data: {
          approvalRate: metrics[0].approvalRate[0] || { approvalRate: 0 },
          averageProcessingTime: metrics[0].averageProcessingTime[0] || {
            averageProcessingDays: 0,
          },
          defaultRate: metrics[0].defaultRate[0] || { defaultRate: 0 },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error generating performance metrics",
        error: error.message,
      });
    }
  }
}

module.exports = LoanReportsController;

// middleware/loanMiddleware.js
const Loan = require("../models/Loan");

// Check loan ownership
const checkLoanOwnership = async (req, res, next) => {
  try {
    const { loanId } = req.params;

    // Managers and Admins can access all loans
    if (req.user.roles.some((role) => ["MANAGER", "ADMIN"].includes(role))) {
      return next();
    }

    // Borrowers can only access their own loans
    const loan = await Loan.findOne({
      loanId,
      borrowerId: req.user.id,
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found or access denied",
      });
    }

    req.loan = loan;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking loan ownership",
      error: error.message,
    });
  }
};

// Validate loan status for operations
const validateLoanStatus = (allowedStatuses) => {
  return async (req, res, next) => {
    try {
      const loan =
        req.loan || (await Loan.findOne({ loanId: req.params.loanId }));

      if (!loan) {
        return res.status(404).json({
          success: false,
          message: "Loan not found",
        });
      }

      if (!allowedStatuses.includes(loan.status)) {
        return res.status(400).json({
          success: false,
          message: `Operation not allowed for loan status: ${loan.status}`,
        });
      }

      req.loan = loan;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error validating loan status",
        error: error.message,
      });
    }
  };
};

module.exports = {
  checkLoanOwnership,
  validateLoanStatus,
};

// Updated routes/loanRoutes.js with additional endpoints
const express = require("express");
const router = express.Router();
const LoanController = require("../controllers/loanController");
const LoanReportsController = require("../controllers/loanReportsController");
const { authenticateToken, authorize } = require("../middleware/auth");
const {
  checkLoanOwnership,
  validateLoanStatus,
} = require("../middleware/loanMiddleware");
const {
  validateLoanApplication,
  validateLoanReview,
  validateLoanPayment,
} = require("../middleware/validation");

// Apply for loan (BORROWER only)
router.post(
  "/apply",
  authenticateToken,
  authorize(["BORROWER"]),
  validateLoanApplication,
  LoanController.applyForLoan
);

// Review loan application (MANAGER/ADMIN only)
router.put(
  "/:loanId/review",
  authenticateToken,
  authorize(["MANAGER", "ADMIN"]),
  validateLoanReview,
  validateLoanStatus(["PENDING"]),
  LoanController.reviewLoanApplication
);

// Disburse loan (MANAGER/ADMIN only)
router.post(
  "/:loanId/disburse",
  authenticateToken,
  authorize(["MANAGER", "ADMIN"]),
  validateLoanStatus(["APPROVED"]),
  LoanController.disburseLoan
);

// Make loan payment (BORROWER)
router.post(
  "/:loanId/payment",
  authenticateToken,
  authorize(["BORROWER"]),
  checkLoanOwnership,
  validateLoanStatus(["ACTIVE"]),
  validateLoanPayment,
  LoanController.makeLoanPayment
);

// Get loan details
router.get(
  "/:loanId",
  authenticateToken,
  authorize(["BORROWER", "MANAGER", "ADMIN"]),
  checkLoanOwnership,
  LoanController.getLoanDetails
);

// Get all loans (role-based filtering)
router.get(
  "/",
  authenticateToken,
  authorize(["BORROWER", "MANAGER", "ADMIN"]),
  LoanController.getAllLoans
);

// Get loan amortization schedule
router.get(
  "/:loanId/amortization",
  authenticateToken,
  authorize(["BORROWER", "MANAGER", "ADMIN"]),
  checkLoanOwnership,
  LoanController.getLoanAmortization
);

// Get loan analytics (MANAGER/ADMIN only)
router.get(
  "/analytics/overview",
  authenticateToken,
  authorize(["MANAGER", "ADMIN"]),
  LoanController.getLoanAnalytics
);

// Loan reports endpoints
router.get(
  "/reports/portfolio",
  authenticateToken,
  authorize(["MANAGER", "ADMIN"]),
  LoanReportsController.getPortfolioSummary
);

router.get(
  "/reports/delinquency",
  authenticateToken,
  authorize(["MANAGER", "ADMIN"]),
  LoanReportsController.getDelinquencyReport
);

router.get(
  "/reports/performance",
  authenticateToken,
  authorize(["MANAGER", "ADMIN"]),
  LoanReportsController.getPerformanceMetrics
);

module.exports = router;

// Example usage and testing
/* 
Usage Examples:

1. Apply for a loan (BORROWER):
POST /api/loans/apply
{
  "loanType": "PERSONAL",
  "principalAmount": 50000,
  "termInMonths": 36,
  "purpose": "Home renovation and improvement",
  "employmentInfo": {
    "employer": "Tech Corp",
    "position": "Software Engineer",
    "monthlyIncome": 8000,
    "workExperience": 3
  },
  "collateral": {
    "type": "Property",
    "description": "Residential property as collateral",
    "value": 100000
  }
}

2. Review loan application (MANAGER/ADMIN):
PUT /api/loans/LN1234567890/review
{
  "action": "APPROVE",
  "comments": "Good credit history and stable income"
}

3. Disburse loan (MANAGER/ADMIN):
POST /api/loans/LN1234567890/disburse
{
  "accountId": "ACC1234567890"
}

4. Make loan payment (BORROWER):
POST /api/loans/LN1234567890/payment
{
  "accountId": "ACC1234567890",
  "amount": 1500
}

5. Get loan details:
GET /api/loans/LN1234567890

6. Get all loans with filters:
GET /api/loans?status=ACTIVE&loanType=PERSONAL&page=1&limit=10


7. Get amortization schedule:
GET /api/loans/LN1234567890/amortization



8. Get analytics (MANAGER/ADMIN):
GET /api/loans/analytics/overview

9. Get reports (MANAGER/ADMIN):
GET /api/loans/reports/portfolio
GET /api/loans/reports/delinquency
GET /api/loans/reports/performance
*/
