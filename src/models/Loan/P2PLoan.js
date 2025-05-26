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
  paymentHistory: [
    {
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
    },
  ],
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
P2PLoanSchema.pre("save", function (next) {
  if (this.isNew) {
    this.loanId = `LN${Date.now()}${Math.random()
      .toString(36)
      .substr(2, 4)
      .toUpperCase()}`;
    this.remainingBalance = this.principalAmount;
    this.totalPayments = this.termInMonths;

    // Set next payment date to 30 days from disbursement
    this.nextPaymentDate = new Date(
      this.disbursementDate.getTime() + 30 * 24 * 60 * 60 * 1000
    );
  }

  this.updatedAt = Date.now();
  next();
});

const P2PLoan = mongoose.model("P2PLoan", P2PLoanSchema);
export default P2PLoan;
