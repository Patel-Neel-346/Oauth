// src/routes/TransactionRoutes.js
import express from "express";
import { Authenticated } from "../middleware/authMiddleware.js";
import { hasRole, ROLE_TYPES } from "../middleware/roleMiddleware.js";
import {
  // Existing transaction methods
  DepositFunds,
  GetAccountBalance,
  GetTransactionHistory,
  TransactionSummary,
  TransferFunds,
  WithDrawFunds,

  // New Stripe integrated methods
  StripeDepositFunds,
  StripePaymentIntent,
  ConfirmStripePayment,
  StripeRefund,
  GetStripeTransactionHistory,

  // Existing Stripe methods
  HandleStripePayment,
  HandleStripeWebhook,
  CreateStripeCustomer,
  AddPaymentMethod,
  GetPaymentMethods,
  RefundPayment,
} from "../controller/TransactionControllerV2.js";

const router = express.Router();

// ========== EJS VIEW ROUTE ==========
// Serve the transaction page
router.get("/", (req, res) => {
  // You can pass sample data or fetch from database
  const sampleTransactions = [
    {
      type: "Deposit",
      amount: 500.0,
      date: "2025-01-15",
      description: "Cash deposit",
    },
    {
      type: "Withdrawal",
      amount: 100.0,
      date: "2025-01-14",
      description: "ATM withdrawal",
    },
    {
      type: "Transfer",
      amount: 250.0,
      date: "2025-01-13",
      description: "Transfer to savings",
    },
  ];

  res.render("index.ejs", { transactions: sampleTransactions });
});

// ========== BASIC TRANSACTION ROUTES ==========

// Deposit funds (Traditional - User, Borrower, Lender)
router.post(
  "/deposit",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  DepositFunds
);

// Withdraw funds (User, Borrower, Lender)
router.post(
  "/withdraw",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  WithDrawFunds
);

// Transfer funds (User, Borrower, Lender)
router.post(
  "/transfer",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  TransferFunds
);

// ========== STRIPE INTEGRATED TRANSACTION ROUTES ==========

// Stripe deposit funds - Process payment and deposit to account
router.post(
  "/stripe/deposit",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  StripeDepositFunds
);

// Create Stripe payment intent for deposits - FIXED ROUTE PATH
router.post(
  "/stripe/create-payment-intent", // Changed from "/stripe/payment-intent"
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  StripePaymentIntent
);

// Alternative route for payment intent (keeping both for compatibility)
router.post(
  "/stripe/payment-intent",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  StripePaymentIntent
);

// Confirm Stripe payment and update transaction status
router.post(
  "/stripe/confirm-payment",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  ConfirmStripePayment
);

// Process Stripe refund
router.post(
  "/stripe/refund",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  StripeRefund
);

// Get Stripe transaction history
router.get(
  "/stripe/history",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  GetStripeTransactionHistory
);

// ========== STRIPE CUSTOMER & PAYMENT METHOD ROUTES ==========

// Stripe Webhook Handler (no auth needed for webhooks)
router.post("/stripe/webhook", HandleStripeWebhook);

// Create/Get Stripe Customer
router.post(
  "/stripe/customer",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  CreateStripeCustomer
);

// Add Payment Method
router.post(
  "/stripe/payment-method",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  AddPaymentMethod
);

// Get User Payment Methods
router.get(
  "/stripe/payment-methods/:customerId",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  GetPaymentMethods
);

// Process Refund (alternative route)
router.post(
  "/stripe/process-refund",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  RefundPayment
);

// ========== GENERAL TRANSACTION ROUTES ==========

// Get transaction history (All authenticated users)
router.get(
  "/history/:accountNumber",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  GetTransactionHistory
);

// Get account balance and filtered transactions
router.get(
  "/getUserAccount",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  GetAccountBalance
);

// Get transaction summary (All authenticated users)
router.get(
  "/summary",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  TransactionSummary
);

export default router;
