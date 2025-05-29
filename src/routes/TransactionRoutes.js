// src/routes/TransactionRoutes.js - Simplified Clean Version
import express from "express";
import { Authenticated } from "../middleware/authMiddleware.js";
import { hasRole, ROLE_TYPES } from "../middleware/roleMiddleware.js";
import {
  DepositFunds,
  GetAccountBalance,
  GetTransactionHistory,
  TransactionSummary,
  TransferFunds,
  WithDrawFunds,
} from "../controller/TransactionControllerV2.js";
// import Role from "../models/Role.js";

const router = express.Router();

// ========== BASIC TRANSACTION ROUTES ==========

// Deposit funds (User, Borrower, Lender)
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
