// src/routes/TransactionRoutes.js - Simplified Clean Version
import express from "express";
import { Authenticated } from "../middleware/authMiddleware.js";
import { hasRole, ROLE_TYPES } from "../middleware/roleMiddleware.js";
import {
  DepositFunds,
  GetTransactionHistory,
  TransactionSummary,
  TransferFunds,
  WithDrawFunds,
} from "../controller/TransactionControllerV2.js";

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

// ========== ADMIN TRANSACTION MANAGEMENT ==========

// // View all transactions (Admin, Manager only)
// router.get(
//   "/admin/all",
//   Authenticated,
//   hasRole([ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER]),
//   async (req, res) => {
//     res.status(200).json({
//       success: true,
//       message: "Admin transaction view - implement controller method",
//       data: { userRole: req.userRoles },
//     });
//   }
// );

// // Cancel transaction (Admin, Manager only)
// router.put(
//   "/admin/cancel/:transactionId",
//   Authenticated,
//   hasRole([ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER]),
//   async (req, res) => {
//     res.status(200).json({
//       success: true,
//       message: "Transaction cancellation - implement controller method",
//       data: { transactionId: req.params.transactionId },
//     });
//   }
// );

// // Reverse transaction (Admin only)
// router.put(
//   "/admin/reverse/:transactionId",
//   Authenticated,
//   hasRole([ROLE_TYPES.ADMIN]),
//   async (req, res) => {
//     res.status(200).json({
//       success: true,
//       message: "Transaction reversal - implement controller method",
//       data: {
//         transactionId: req.params.transactionId,
//         reason: req.body.reason,
//       },
//     });
//   }
// );

export default router;
