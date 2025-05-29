import { ApiError } from "../helpers/ApiError.js";
import Role from "../models/Role.js";
import { ROLE_TYPES } from "../models/Role.js";

const ROLE_HIERARCHY = {
  [ROLE_TYPES.USER]: 1,
  [ROLE_TYPES.BORROWER]: 2,
  [ROLE_TYPES.LENDER]: 3,
  [ROLE_TYPES.MANAGER]: 4,
  [ROLE_TYPES.ADMIN]: 5,
};

export const hasRole = (allowedRoles, options = {}) => {
  return async (req, res, next) => {
    try {
      const userId = req.user;

      if (!userId) {
        return next(new ApiError(401, "Authentication required"));
      }

      // Get user roles from database
      const userRoles = await Role.find({ users: userId }).select(
        "name permissions"
      );

      if (!userRoles || userRoles.length === 0) {
        return next(new ApiError(403, "No roles assigned to user"));
      }

      const roleNames = userRoles.map((role) => role.name);

      // Check if user has any of the required roles
      const hasRequiredRole = roleNames.some((role) =>
        allowedRoles.includes(role)
      );

      if (!hasRequiredRole) {
        return next(
          new ApiError(
            403,
            `Access Denied: Requires one of these roles: ${allowedRoles.join(
              ", "
            )}`
          )
        );
      }

      // Add user roles to request object for further use
      req.userRoles = roleNames;
      req.userPermissions = userRoles.flatMap((role) => role.permissions || []);

      next();
    } catch (error) {
      console.error("Role check error:", error);
      return next(new ApiError(500, "Error checking user permissions"));
    }
  };
};

export const hasMinimumRole = (requiredRole, options = {}) => {
  return async (req, res, next) => {
    try {
      const userId = req.user;

      if (!userId) {
        return next(new ApiError(401, "Authentication required"));
      }

      const userRoles = await Role.find({ users: userId }).select("name");
      const roleNames = userRoles.map((role) => role.name);

      // Check if user has the minimum required role or higher
      const userMaxLevel = Math.max(
        ...roleNames.map((role) => ROLE_HIERARCHY[role] || 0)
      );
      const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;

      if (userMaxLevel < requiredLevel) {
        return next(
          new ApiError(
            403,
            `Access Denied: Requires minimum ${requiredRole} role`
          )
        );
      }

      req.userRoles = roleNames;
      next();
    } catch (error) {
      console.error("Minimum role check error:", error);
      return next(new ApiError(500, "Error checking user permissions"));
    }
  };
};

export const checkResourceOwnership = (
  resourceField = "userId",
  exemptRoles = [ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER]
) => {
  return async (req, res, next) => {
    try {
      const userId = req.user;

      // Get user roles
      const userRoles = await Role.find({ users: userId }).select("name");
      const roleNames = userRoles.map((role) => role.name);

      // Check if user has exempt roles (admin, manager)
      const hasExemptRole = roleNames.some((role) =>
        exemptRoles.includes(role)
      );

      if (hasExemptRole) {
        req.userRoles = roleNames;
        return next();
      }

      // For non-exempt users, check resource ownership
      const resourceUserId =
        req.params[resourceField] ||
        req.body[resourceField] ||
        req.query[resourceField];

      if (resourceUserId && resourceUserId.toString() !== userId.toString()) {
        return next(
          new ApiError(
            403,
            "Access Denied: You can only access your own resources"
          )
        );
      }

      req.userRoles = roleNames;
      next();
    } catch (error) {
      console.error("Resource ownership check error:", error);
      return next(new ApiError(500, "Error checking resource ownership"));
    }
  };
};

export const checkAccountOwnership = (accountParam = "accountId") => {
  return async (req, res, next) => {
    try {
      const userId = req.user;
      const accountId = req.params[accountParam] || req.body[accountParam];

      if (!accountId) {
        return next(new ApiError(400, "Account ID is required"));
      }

      // Import Account model dynamically to avoid circular dependency
      const Account = (await import("../models/Account.js")).default;
      const account = await Account.findById(accountId);

      if (!account) {
        return next(new ApiError(404, "Account not found"));
      }

      // Get user roles
      const userRoles = await Role.find({ users: userId }).select("name");
      const roleNames = userRoles.map((role) => role.name);

      // Admin and Manager can access any account
      const canAccessAnyAccount = roleNames.some((role) =>
        [ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER].includes(role)
      );

      if (
        !canAccessAnyAccount &&
        account.userId.toString() !== userId.toString()
      ) {
        return next(
          new ApiError(
            403,
            "Access Denied: You can only access your own accounts"
          )
        );
      }

      req.userRoles = roleNames;
      req.targetAccount = account;
      next();
    } catch (error) {
      console.error("Account ownership check error:", error);
      return next(new ApiError(500, "Error checking account ownership"));
    }
  };
};

export const loanRoleChecks = {
  // Only lenders can create loan offers
  canCreateLoanOffer: hasRole([ROLE_TYPES.LENDER]),

  // Only borrowers can apply for loans
  canApplyForLoan: hasRole([ROLE_TYPES.BORROWER]),

  // Only lenders can review applications for their offers
  canReviewApplication: hasRole([ROLE_TYPES.LENDER]),

  // Only admins can give final approval
  canGiveFinalApproval: hasRole([ROLE_TYPES.ADMIN]),

  // Only admins can disburse loans
  canDisburseLoan: hasRole([ROLE_TYPES.ADMIN]),

  // Borrowers and lenders can view loan details, admins can view all
  canViewLoanDetails: hasRole([
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
  ]),

  // Only borrowers can make payments
  canMakePayment: hasRole([ROLE_TYPES.BORROWER]),

  // Only admins can view overdue loans
  canViewOverdueLoans: hasRole([ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER]),
};

/**
 * Transaction-specific role checks
 */
export const transactionRoleChecks = {
  // Users, borrowers, and lenders can perform basic transactions
  canPerformTransaction: hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
  ]),

  // Admins and managers can view all transactions
  canViewAllTransactions: hasRole([ROLE_TYPES.ADMIN, ROLE_TYPES.MANAGER]),

  // Users can view their own transaction history
  canViewOwnTransactions: hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),
};

/**
 * Account-specific role checks
 */
export const accountRoleChecks = {
  // All authenticated users can create basic accounts
  canCreateAccount: hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
  ]),

  // Users can view their own accounts, admins can view all
  canViewAccount: hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
    ROLE_TYPES.MANAGER,
  ]),

  // Users can update their own accounts, admins can update any
  canUpdateAccount: hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
  ]),

  // Account closure might need admin approval for certain types
  canCloseAccount: hasRole([
    ROLE_TYPES.USER,
    ROLE_TYPES.BORROWER,
    ROLE_TYPES.LENDER,
    ROLE_TYPES.ADMIN,
  ]),
};

/**
 * Combined middleware for complex access control
 * @param {Object} config - Configuration object with role and ownership checks
 * @returns {Array} Array of middleware functions
 */
export const complexAccessControl = (config) => {
  const middlewares = [];

  if (config.roles) {
    middlewares.push(hasRole(config.roles));
  }

  if (config.minimumRole) {
    middlewares.push(hasMinimumRole(config.minimumRole));
  }

  if (config.checkOwnership) {
    middlewares.push(
      checkResourceOwnership(config.ownershipField, config.exemptRoles)
    );
  }

  if (config.checkAccountOwnership) {
    middlewares.push(checkAccountOwnership(config.accountParam));
  }

  return middlewares;
};

// Export individual role constants for easy access
export { ROLE_TYPES, ROLE_HIERARCHY };
