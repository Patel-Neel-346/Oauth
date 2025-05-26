// src/config/permissions.js - Banking Permission System
export const PERMISSIONS = {
  // Account Management
  ACCOUNT_CREATE: "account:create",
  ACCOUNT_READ_OWN: "account:read:own",
  ACCOUNT_READ_ALL: "account:read:all",
  ACCOUNT_UPDATE_OWN: "account:update:own",
  ACCOUNT_UPDATE_ALL: "account:update:all",
  ACCOUNT_DELETE_OWN: "account:delete:own",
  ACCOUNT_DELETE_ALL: "account:delete:all",
  ACCOUNT_FREEZE: "account:freeze",
  ACCOUNT_UNFREEZE: "account:unfreeze",

  // Transaction Management
  TRANSACTION_CREATE: "transaction:create",
  TRANSACTION_READ_OWN: "transaction:read:own",
  TRANSACTION_READ_ALL: "transaction:read:all",
  TRANSACTION_APPROVE: "transaction:approve",
  TRANSACTION_REJECT: "transaction:reject",
  TRANSACTION_REVERSE: "transaction:reverse",

  // Loan Management
  LOAN_APPLY: "loan:apply",
  LOAN_APPROVE: "loan:approve",
  LOAN_REJECT: "loan:reject",
  LOAN_DISBURSE: "loan:disburse",
  LOAN_READ_OWN: "loan:read:own",
  LOAN_READ_ALL: "loan:read:all",
  LOAN_UPDATE_OWN: "loan:update:own",
  LOAN_UPDATE_ALL: "loan:update:all",

  // Lending (P2P)
  LENDING_OFFER_CREATE: "lending:offer:create",
  LENDING_OFFER_READ: "lending:offer:read",
  LENDING_OFFER_UPDATE: "lending:offer:update",
  LENDING_REQUEST_CREATE: "lending:request:create",
  LENDING_REQUEST_APPROVE: "lending:request:approve",
  LENDING_FUND_TRANSFER: "lending:fund:transfer",

  // User Management
  USER_READ_OWN: "user:read:own",
  USER_READ_ALL: "user:read:all",
  USER_UPDATE_OWN: "user:update:own",
  USER_UPDATE_ALL: "user:update:all",
  USER_SUSPEND: "user:suspend",
  USER_ACTIVATE: "user:activate",

  // Profile Management
  PROFILE_UPDATE_OWN: "profile:update:own",
  PROFILE_UPDATE_ALL: "profile:update:all",
  PROFILE_VERIFY: "profile:verify",

  // Admin Operations
  ADMIN_DASHBOARD: "admin:dashboard",
  ADMIN_REPORTS: "admin:reports",
  ADMIN_AUDIT_LOGS: "admin:audit:logs",
  ADMIN_SYSTEM_CONFIG: "admin:system:config",

  // Financial Operations
  BALANCE_CHECK_OWN: "balance:check:own",
  BALANCE_CHECK_ALL: "balance:check:all",
  BALANCE_MODIFY: "balance:modify",
  INTEREST_CALCULATE: "interest:calculate",
  INTEREST_APPLY: "interest:apply",
};

export const ROLE_PERMISSIONS = {
  [ROLE_TYPES.USER]: [
    // Basic account operations
    PERMISSIONS.ACCOUNT_CREATE,
    PERMISSIONS.ACCOUNT_READ_OWN,
    PERMISSIONS.ACCOUNT_UPDATE_OWN,

    // Basic transactions
    PERMISSIONS.TRANSACTION_CREATE,
    PERMISSIONS.TRANSACTION_READ_OWN,

    // Profile management
    PERMISSIONS.USER_READ_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.PROFILE_UPDATE_OWN,

    // Balance operations
    PERMISSIONS.BALANCE_CHECK_OWN,
  ],

  [ROLE_TYPES.BORROWER]: [
    // Inherit all USER permissions
    ...(ROLE_PERMISSIONS[ROLE_TYPES.USER] || []),

    // Loan operations
    PERMISSIONS.LOAN_APPLY,
    PERMISSIONS.LOAN_READ_OWN,
    PERMISSIONS.LOAN_UPDATE_OWN,

    // P2P borrowing
    PERMISSIONS.LENDING_REQUEST_CREATE,
    PERMISSIONS.LENDING_OFFER_READ,
  ],

  [ROLE_TYPES.LENDER]: [
    // Inherit all USER permissions
    ...(ROLE_PERMISSIONS[ROLE_TYPES.USER] || []),

    // Lending operations
    PERMISSIONS.LENDING_OFFER_CREATE,
    PERMISSIONS.LENDING_OFFER_READ,
    PERMISSIONS.LENDING_OFFER_UPDATE,
    PERMISSIONS.LENDING_REQUEST_APPROVE,
    PERMISSIONS.LENDING_FUND_TRANSFER,

    // Enhanced financial operations
    PERMISSIONS.INTEREST_CALCULATE,

    // Can also take loans
    PERMISSIONS.LOAN_APPLY,
    PERMISSIONS.LOAN_READ_OWN,
  ],

  [ROLE_TYPES.MANAGER]: [
    // User management
    PERMISSIONS.USER_READ_ALL,
    PERMISSIONS.USER_UPDATE_ALL,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.USER_ACTIVATE,

    // Account management
    PERMISSIONS.ACCOUNT_READ_ALL,
    PERMISSIONS.ACCOUNT_UPDATE_ALL,
    PERMISSIONS.ACCOUNT_FREEZE,
    PERMISSIONS.ACCOUNT_UNFREEZE,

    // Transaction oversight
    PERMISSIONS.TRANSACTION_READ_ALL,
    PERMISSIONS.TRANSACTION_APPROVE,
    PERMISSIONS.TRANSACTION_REJECT,

    // Loan management
    PERMISSIONS.LOAN_READ_ALL,
    PERMISSIONS.LOAN_APPROVE,
    PERMISSIONS.LOAN_REJECT,
    PERMISSIONS.LOAN_UPDATE_ALL,

    // Profile verification
    PERMISSIONS.PROFILE_VERIFY,
    PERMISSIONS.PROFILE_UPDATE_ALL,

    // Financial operations
    PERMISSIONS.BALANCE_CHECK_ALL,
    PERMISSIONS.INTEREST_APPLY,
  ],

  [ROLE_TYPES.ADMIN]: [
    // All permissions - complete system access
    ...Object.values(PERMISSIONS),
  ],
};

// Helper function to check if a role has a specific permission
export const roleHasPermission = (roleName, permission) => {
  const rolePermissions = ROLE_PERMISSIONS[roleName] || [];
  return rolePermissions.includes(permission);
};

// Helper function to get all permissions for multiple roles
export const getUserPermissions = (userRoles) => {
  const permissions = new Set();

  userRoles.forEach((role) => {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    rolePermissions.forEach((permission) => permissions.add(permission));
  });

  return Array.from(permissions);
};

// Banking-specific business rules
export const BANKING_RULES = {
  // Transaction limits by role
  TRANSACTION_LIMITS: {
    [ROLE_TYPES.USER]: {
      daily: 10000,
      monthly: 100000,
      single: 5000,
    },
    [ROLE_TYPES.BORROWER]: {
      daily: 15000,
      monthly: 150000,
      single: 7500,
    },
    [ROLE_TYPES.LENDER]: {
      daily: 50000,
      monthly: 500000,
      single: 25000,
    },
  },

  // Loan limits by role
  LOAN_LIMITS: {
    [ROLE_TYPES.BORROWER]: {
      maximum: 500000,
      minimumCreditScore: 600,
      maxDebtToIncomeRatio: 0.4,
    },
    [ROLE_TYPES.LENDER]: {
      maximum: 1000000, // Can take larger loans due to lending income
      minimumCreditScore: 650,
      maxDebtToIncomeRatio: 0.35,
    },
  },

  // Account type restrictions
  ACCOUNT_TYPE_RESTRICTIONS: {
    [ROLE_TYPES.USER]: ["savings", "checking"],
    [ROLE_TYPES.BORROWER]: ["savings", "checking", "loan"],
    [ROLE_TYPES.LENDER]: ["savings", "checking", "investment", "loan"],
    [ROLE_TYPES.MANAGER]: ["savings", "checking", "loan", "investment"],
    [ROLE_TYPES.ADMIN]: [
      "savings",
      "checking",
      "loan",
      "investment",
      "corporate",
    ],
  },

  // Verification requirements
  VERIFICATION_REQUIREMENTS: {
    [ROLE_TYPES.BORROWER]: {
      requiredDocuments: ["id", "income", "address"],
      minimumCreditScore: 600,
      employmentVerification: true,
    },
    [ROLE_TYPES.LENDER]: {
      requiredDocuments: ["id", "income", "address", "financial_statement"],
      minimumNetWorth: 100000,
      bankStatements: true,
    },
  },
};

import { ROLE_TYPES } from "../models/Role.js";
