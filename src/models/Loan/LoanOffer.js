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
  termOptions: [
    {
      type: Number, // in months
      min: 0,
      max: 360,
    },
  ],
  loanPurpose: [
    {
      type: String,
      enum: ["personal", "business", "home", "education", "vehicle", "other"],
    },
  ],
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
    employmentStatus: [
      {
        type: String,
        enum: ["employed", "self-employed", "unemployed", "retired", "student"],
      },
    ],
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
  applications: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LoanApplication",
    },
  ],
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
LoanOfferSchema.pre("save", function (next) {
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
