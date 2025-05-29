// // src/models/LoanPayment.js
// import mongoose from "mongoose";

// const LoanPaymentSchema = new mongoose.Schema({
//   loanId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Loan",
//     required: true,
//   },
//   amount: {
//     type: Number,
//     required: true,
//   },
//   paymentDate: {
//     type: Date,
//     default: Date.now,
//   },
//   status: {
//     type: String,
//     enum: ["pending", "completed", "failed", "late"],
//     default: "pending",
//   },
//   paymentMethod: {
//     type: String,
//     enum: [
//       "bank_transfer",
//       "cash",
//       "check",
//       "automatic_debit",
//       "online_payment",
//     ],
//   },
//   transactionId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Transaction",
//   },
//   notes: {
//     type: String,
//   },
// });

// const LoanPayment = mongoose.model("LoanPayment", LoanPaymentSchema);
// export default LoanPayment;
