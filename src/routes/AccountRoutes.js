// src/routes/AccountRoutes.js
import express from "express";
import {
  CreateAccount,
  getAllAccount,
  getUserAccount,
  UpdateUserAccount,
  CloseUserAccount,
} from "../controller/AccountController.js";
import { Authenticated } from "../middleware/authMiddleware.js";
import { hasRole, ROLE_TYPES } from "../middleware/roleMiddleware.js";
import {
  createAccountValidation,
  getAllAccountsValidation,
  getUserAccountValidation,
  updateUserAccountValidation,
  closeUserAccountValidation,
} from "../middleware/accountValidation.js";
// import { ApiError } from "../utils/ApiError.js";

const AccountRoute = express.Router();

// Create account - All authenticated users can create accounts
AccountRoute.post(
  "/",
  Authenticated,
  hasRole([ROLE_TYPES.USER, ROLE_TYPES.BORROWER, ROLE_TYPES.LENDER]),
  createAccountValidation,
  CreateAccount
);

// Get all accounts - Admins and managers can see all
AccountRoute.get(
  "/",
  Authenticated,
  hasRole([ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER]),
  getAllAccountsValidation,
  getAllAccount
);

// Get specific account - Users can view their own accounts, admins can view any
AccountRoute.get(
  "/:accountId",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
  getUserAccountValidation,
  getUserAccount
);

// Update account - Users can update their own accounts, admins can update any
AccountRoute.put(
  "/:accountId",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
  ]),
  updateUserAccountValidation,
  UpdateUserAccount
);

// Close account - Users can close their own accounts, admins can close any
AccountRoute.post(
  "/:accountId/close",
  Authenticated,
  hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
  ]),
  closeUserAccountValidation,
  CloseUserAccount
);

export default AccountRoute;
