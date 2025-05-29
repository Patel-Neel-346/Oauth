// // src/models/Loan.js
// import mongoose from "mongoose";

// const LoanSchema = new mongoose.Schema({
//   borrowerId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true,
//   },
//   lenderId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//   },
//   amount: {
//     type: Number,
//     required: true,
//   },
//   interestRate: {
//     type: Number,
//     required: true,
//   },
//   term: {
//     type: Number, // in months
//     required: true,
//   },
//   purpose: {
//     type: String,
//     enum: ["personal", "business", "home", "education", "vehicle", "other"],
//     required: true,
//   },
//   status: {
//     type: String,
//     enum: [
//       "pending",
//       "approved",
//       "rejected",
//       "active",
//       "completed",
//       "defaulted",
//     ],
//     default: "pending",
//   },
//   instalmentAmount: {
//     type: Number,
//   },
//   remainingAmount: {
//     type: Number,
//   },
//   nextPaymentDate: {
//     type: Date,
//   },
//   applicationDate: {
//     type: Date,
//     default: Date.now,
//   },
//   approvalDate: {
//     type: Date,
//   },
//   disbursementDate: {
//     type: Date,
//   },
//   completionDate: {
//     type: Date,
//   },
//   // Documents related to the loan (ID verification, income proof, etc.)
//   documents: [
//     {
//       documentType: {
//         type: String,
//         enum: ["id", "income", "collateral", "agreement", "other"],
//       },
//       documentUrl: String,
//       uploadDate: {
//         type: Date,
//         default: Date.now,
//       },
//     },
//   ],
// });

// // Calculate installment amount before saving
// LoanSchema.pre("save", function (next) {
//   if (
//     this.isModified("amount") ||
//     this.isModified("interestRate") ||
//     this.isModified("term")
//   ) {
//     // Simple installment calculation
//     const principal = this.amount;
//     const monthlyRate = this.interestRate / 100 / 12;
//     const term = this.term;

//     // Using formula: P * r * (1+r)^n / ((1+r)^n - 1)
//     this.instalmentAmount =
//       (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) /
//       (Math.pow(1 + monthlyRate, term) - 1);

//     this.remainingAmount = this.amount;
//   }
//   next();
// });

// const Loan = mongoose.model("Loan", LoanSchema);
// export default Loan;
