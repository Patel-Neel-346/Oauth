// src/middleware/roleMiddleware.js - Enhanced Role & Permission System
import { ApiError } from "../helpers/ApiError.js";
import Role from "../models/Role.js";
import Account from "../models/Account.js";
import { ROLE_TYPES } from "../models/Role.js";
import RoleUserService from "../utils/roleUserService.js";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getUserPermissions,
  roleHasPermission,
  BANKING_RULES,
} from "../config/permissions.js";

/**
 * Basic role checking middleware
 */
export const hasRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user;

      if (!userId) {
        return next(new ApiError(401, "User not authenticated"));
      }

      const userProfile = await RoleUserService.getUserCompleteProfile(userId);

      if (!userProfile.roles || userProfile.roles.length === 0) {
        return next(new ApiError(403, "No roles assigned to user"));
      }

      // Check if user has any of the allowed roles
      const hasRequiredRole = userProfile.roles.some((role) =>
        allowedRoles.includes(role)
      );

      if (!hasRequiredRole) {
        return next(
          new ApiError(
            403,
            `Access Denied: Requires one of the following roles: ${allowedRoles.join(
              ", "
            )}`
          )
        );
      }

      // Attach user profile to request
      req.userProfile = userProfile;
      req.userRoles = userProfile.roles;
      req.userPermissions = getUserPermissions(userProfile.roles);

      next();
    } catch (error) {
      console.error("Role middleware error:", error);
      return next(new ApiError(500, "Error checking user permissions"));
    }
  };
};

/**
 * Permission-based access control middleware
 */
export const hasPermission = (requiredPermissions) => {
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return async (req, res, next) => {
    try {
      // Ensure user is authenticated and has roles
      if (!req.userPermissions) {
        const userId = req.user;
        if (!userId) {
          return next(new ApiError(401, "User not authenticated"));
        }

        const userProfile = await RoleUserService.getUserCompleteProfile(
          userId
        );
        req.userProfile = userProfile;
        req.userRoles = userProfile.roles;
        req.userPermissions = getUserPermissions(userProfile.roles);
      }

      // Check if user has all required permissions
      const hasAllPermissions = permissions.every((permission) =>
        req.userPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        return next(
          new ApiError(
            403,
            `Access Denied: Missing required permissions: ${permissions.join(
              ", "
            )}`
          )
        );
      }

      next();
    } catch (error) {
      console.error("Permission middleware error:", error);
      return next(new ApiError(500, "Error checking permissions"));
    }
  };
};

/**
 * Account ownership verification middleware
 */
export const verifyAccountOwnership = async (req, res, next) => {
  try {
    const userId = req.user;
    const { accountId } = req.params;

    if (!accountId) {
      return next(new ApiError(400, "Account ID is required"));
    }

    // Get user permissions if not already loaded
    if (!req.userPermissions) {
      const userProfile = await RoleUserService.getUserCompleteProfile(userId);
      req.userProfile = userProfile;
      req.userRoles = userProfile.roles;
      req.userPermissions = getUserPermissions(userProfile.roles);
    }

    // Admins and managers can access any account
    if (
      req.userPermissions.includes(PERMISSIONS.ACCOUNT_READ_ALL) ||
      req.userPermissions.includes(PERMISSIONS.ACCOUNT_UPDATE_ALL)
    ) {
      return next();
    }

    // For regular users, verify they own the account
    const account = await Account.findOne({
      _id: accountId,
      userId: userId,
    });

    if (!account) {
      return next(
        new ApiError(404, "Account not found or you don't have access to it")
      );
    }

    req.targetAccount = account;
    next();
  } catch (error) {
    console.error("Account ownership verification error:", error);
    return next(new ApiError(500, "Error verifying account ownership"));
  }
};

/**
 * Banking transaction limits middleware
 */
export const checkTransactionLimits = async (req, res, next) => {
  try {
    const userId = req.user;
    const { amount, type } = req.body;

    if (!amount || amount <= 0) {
      return next(new ApiError(400, "Valid transaction amount is required"));
    }

    // Get user roles if not loaded
    if (!req.userRoles) {
      const userProfile = await RoleUserService.getUserCompleteProfile(userId);
      req.userRoles = userProfile.roles;
    }

    // Admins bypass limits
    if (req.userRoles.includes(ROLE_TYPES.ADMIN)) {
      return next();
    }

    // Get highest role for limits (LENDER > BORROWER > USER)
    let userRole = ROLE_TYPES.USER;
    if (req.userRoles.includes(ROLE_TYPES.LENDER)) {
      userRole = ROLE_TYPES.LENDER;
    } else if (req.userRoles.includes(ROLE_TYPES.BORROWER)) {
      userRole = ROLE_TYPES.BORROWER;
    }

    const limits = BANKING_RULES.TRANSACTION_LIMITS[userRole];

    // Check single transaction limit
    if (amount > limits.single) {
      return next(
        new ApiError(
          400,
          `Transaction amount exceeds single transaction limit of ${limits.single}`
        )
      );
    }

    // TODO: Check daily and monthly limits against actual transaction history
    // This would require querying transaction history

    next();
  } catch (error) {
    console.error("Transaction limits check error:", error);
    return next(new ApiError(500, "Error checking transaction limits"));
  }
};

/**
 * Loan eligibility middleware
 */
export const checkLoanEligibility = async (req, res, next) => {
  try {
    const userId = req.user;
    const { amount, purpose } = req.body;

    // Get user profile with borrower details
    const userProfile = await RoleUserService.getUserCompleteProfile(userId);

    if (
      !userProfile.roles.includes(ROLE_TYPES.BORROWER) &&
      !userProfile.roles.includes(ROLE_TYPES.LENDER)
    ) {
      return next(
        new ApiError(403, "Only borrowers and lenders can apply for loans")
      );
    }

    const userRole = userProfile.roles.includes(ROLE_TYPES.LENDER)
      ? ROLE_TYPES.LENDER
      : ROLE_TYPES.BORROWER;

    const loanLimits = BANKING_RULES.LOAN_LIMITS[userRole];

    // Check loan amount limit
    if (amount > loanLimits.maximum) {
      return next(
        new ApiError(
          400,
          `Loan amount exceeds maximum limit of ${loanLimits.maximum} for ${userRole}`
        )
      );
    }

    // Check borrower profile requirements
    if (userRole === ROLE_TYPES.BORROWER && userProfile.borrowerProfile) {
      const profile = userProfile.borrowerProfile;

      // Credit score check
      if (profile.creditScore < loanLimits.minimumCreditScore) {
        return next(
          new ApiError(
            400,
            `Credit score ${profile.creditScore} is below minimum requirement of ${loanLimits.minimumCreditScore}`
          )
        );
      }

      // Debt-to-income ratio check
      if (profile.debtToIncomeRatio > loanLimits.maxDebtToIncomeRatio) {
        return next(
          new ApiError(
            400,
            `Debt-to-income ratio ${profile.debtToIncomeRatio} exceeds maximum of ${loanLimits.maxDebtToIncomeRatio}`
          )
        );
      }

      // Verification status check
      if (profile.verificationStatus !== "verified") {
        return next(
          new ApiError(
            400,
            "Borrower profile must be verified to apply for loans"
          )
        );
      }
    }

    req.userProfile = userProfile;
    next();
  } catch (error) {
    console.error("Loan eligibility check error:", error);
    return next(new ApiError(500, "Error checking loan eligibility"));
  }
};

/**
 * Account type access control middleware
 */
export const canAccessAccountType = (accountType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user;

      // Get user roles if not loaded
      if (!req.userRoles) {
        const userProfile = await RoleUserService.getUserCompleteProfile(
          userId
        );
        req.userRoles = userProfile.roles;
      }

      // Check if any of user's roles can access this account type
      const canAccess = req.userRoles.some((role) => {
        const allowedTypes =
          BANKING_RULES.ACCOUNT_TYPE_RESTRICTIONS[role] || [];
        return allowedTypes.includes(accountType);
      });

      if (!canAccess) {
        return next(
          new ApiError(
            403,
            `Access denied: Your role(s) cannot access ${accountType} accounts`
          )
        );
      }

      next();
    } catch (error) {
      console.error("Account type access control error:", error);
      return next(new ApiError(500, "Error checking account type access"));
    }
  };
};

/**
 * Profile verification middleware
 */
export const requireVerifiedProfile = (profileType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user;
      const userProfile = await RoleUserService.getUserCompleteProfile(userId);

      if (profileType === "borrower" && userProfile.borrowerProfile) {
        if (userProfile.borrowerProfile.verificationStatus !== "verified") {
          return next(
            new ApiError(
              400,
              "Borrower profile must be verified for this operation"
            )
          );
        }
      }

      if (profileType === "lender" && userProfile.lenderProfile) {
        if (userProfile.lenderProfile.verificationStatus !== "verified") {
          return next(
            new ApiError(
              400,
              "Lender profile must be verified for this operation"
            )
          );
        }
      }

      req.userProfile = userProfile;
      next();
    } catch (error) {
      console.error("Profile verification error:", error);
      return next(new ApiError(500, "Error checking profile verification"));
    }
  };
};

/**
 * Utility function to get role-based account filter for queries
 */
export const getRoleBasedAccountFilter = (userId, userRoles) => {
  // Admins and managers can see all accounts
  if (
    userRoles.includes(ROLE_TYPES.ADMIN) ||
    userRoles.includes(ROLE_TYPES.MANAGER)
  ) {
    return {}; // No filter - can see all accounts
  }

  return { userId }; // Filter to only user's accounts
};

/**
 * Utility function to get role-based field projection
 */
export const getRoleBasedFieldFilter = (userRoles) => {
  // Admins and managers see all fields
  if (
    userRoles.includes(ROLE_TYPES.ADMIN) ||
    userRoles.includes(ROLE_TYPES.MANAGER)
  ) {
    return {}; // No field restrictions
  }

  // Regular users see limited fields
  return {
    _id: 1,
    accountNumber: 1,
    accountType: 1,
    balance: 1,
    currency: 1,
    status: 1,
    interestRate: 1,
    createdAt: 1,
    updatedAt: 1,
  };
};
