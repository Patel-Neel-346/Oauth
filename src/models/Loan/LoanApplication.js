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
  documents: [
    {
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
    },
  ],
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
    criteria: [
      {
        name: String,
        required: mongoose.Schema.Types.Mixed,
        actual: mongoose.Schema.Types.Mixed,
        passed: Boolean,
      },
    ],
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
    default: function () {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    },
  },
});

// Generate application ID and calculate EMI before saving
LoanApplicationSchema.pre("save", function (next) {
  if (this.isNew) {
    this.applicationId = `LA${Date.now()}${Math.random()
      .toString(36)
      .substr(2, 4)
      .toUpperCase()}`;
  }

  // Calculate EMI if all required fields are present
  if (this.requestedAmount && this.interestRate && this.selectedTerm) {
    const principal = this.requestedAmount;
    const monthlyRate = this.interestRate / 100 / 12;
    const term = this.selectedTerm;

    if (monthlyRate === 0) {
      this.calculatedEMI = principal / term;
    } else {
      this.calculatedEMI =
        (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) /
        (Math.pow(1 + monthlyRate, term) - 1);
    }

    this.totalPayableAmount = this.calculatedEMI * term;
  }

  next();
});

const LoanApplication = mongoose.model(
  "LoanApplication",
  LoanApplicationSchema
);
export default LoanApplication;
