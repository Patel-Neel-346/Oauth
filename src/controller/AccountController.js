import { asyncHandler } from "../helpers/asyncHandler.js";
import { ApiError } from "../helpers/ApiError.js";
import { ApiRes } from "../helpers/ApiRespones.js";
import Account from "../models/Account.js";
import User from "../models/User.js";
import RoleUserService from "../utils/roleUserService.js";
import { ROLE_TYPES } from "../models/Role.js";

export const CreateAccount = asyncHandler(async (req, res, next) => {
  const { accountType, initialDeposit = 0, currency = "₹" } = req.body;
  const userId = req.user;

  if (!accountType) {
    return next(new ApiError(400, "Account type is required"));
  }

  const validAccountTypes = [
    "savings",
    "checking",
    "loan",
    "credit",
    "investment",
  ];
  if (!validAccountTypes.includes(accountType)) {
    return next(new ApiError(400, "Invalid account type"));
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(new ApiError(404, "User not found"));
    }

    const userProfile = await RoleUserService.getUserCompleteProfile(userId);

    const canCreateAccount = await validateAccountCreationByRole(
      accountType,
      userProfile.roles,
      userProfile
    );

    if (!canCreateAccount.allowed) {
      return next(new ApiError(403, canCreateAccount.message));
    }

    const accountLimitCheck = await checkAccountLimits(
      userId,
      accountType,
      userProfile.roles
    );
    if (!accountLimitCheck.allowed) {
      return next(new ApiError(403, accountLimitCheck.message));
    }

    const accountNumber = await generateAccountNumber(accountType);

    const minDepositValidation = validateMinimumDeposit(
      accountType,
      initialDeposit,
      userProfile.roles
    );
    if (!minDepositValidation.valid) {
      return next(new ApiError(400, minDepositValidation.message));
    }

    const interestRate = calculateInterestRate(accountType, userProfile);

    const newAccount = await Account.create({
      userId,
      accountNumber,
      accountType,
      balance: initialDeposit,
      currency,
      interestRate,
      status: "active",
    });

    if (
      !user.accountNumber &&
      (accountType === "savings" || accountType === "checking")
    ) {
      user.accountNumber = accountNumber;
      await user.save();
    }

    res.status(201).json(
      new ApiRes(
        201,
        {
          account: {
            _id: newAccount._id,
            accountNumber: newAccount.accountNumber,
            accountType: newAccount.accountType,
            balance: newAccount.balance,
            currency: newAccount.currency,
            status: newAccount.status,
            interestRate: newAccount.interestRate,
            createdAt: newAccount.createdAt,
          },
        },
        "Account created successfully"
      )
    );
  } catch (error) {
    console.error("Account creation error:", error);
    return next(new ApiError(500, error.message || "Failed to create account"));
  }
});

export const getAllAccount = asyncHandler(async (req, res, next) => {
  const userId = req.user;
  const { status, accountType, page = 1, limit = 10 } = req.query;

  try {
    const userProfile = await RoleUserService.getUserCompleteProfile(userId);

    const filter = await buildAccountFilterByRole(userId, userProfile.roles, {
      status,
      accountType,
    });

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const accounts = await Account.find(filter)
      .select("-__v")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter sensitive information based on user role
    const filteredAccounts = filterAccountDataByRole(
      accounts,
      userProfile.roles
    );

    // Get total count for pagination
    const totalAccounts = await Account.countDocuments(filter);
    const totalPages = Math.ceil(totalAccounts / parseInt(limit));

    // Calculate total balance across accessible accounts
    const totalBalance = filteredAccounts.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    res.status(200).json(
      new ApiRes(
        200,
        {
          accounts: filteredAccounts,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalAccounts,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1,
          },
          summary: {
            totalBalance,
            accountCount: filteredAccounts.length,
            currency:
              filteredAccounts.length > 0 ? filteredAccounts[0].currency : "₹",
          },
          userRoles: userProfile.roles, // Include user roles for frontend logic
        },
        "Accounts retrieved successfully"
      )
    );
  } catch (error) {
    console.error("Get accounts error:", error);
    return next(new ApiError(500, "Failed to retrieve accounts"));
  }
});

// Get specific account details with role-based access control
export const getUserAccount = asyncHandler(async (req, res, next) => {
  const userId = req.user;
  const { accountId } = req.params;

  try {
    // Get user's complete profile with roles
    const userProfile = await RoleUserService.getUserCompleteProfile(userId);

    // Build query based on user role
    let query = { _id: accountId };

    // Non-admin users can only access their own accounts
    if (!userProfile.roles.includes(ROLE_TYPES.ADMIN)) {
      query.userId = userId;
    }

    // Find account
    const account = await Account.findOne(query).select("-__v");

    if (!account) {
      return next(new ApiError(404, "Account not found or access denied"));
    }

    // Check if user has permission to view this account type
    const canViewAccount = await validateAccountAccess(
      account.accountType,
      userProfile.roles,
      account.userId,
      userId
    );
    if (!canViewAccount.allowed) {
      return next(new ApiError(403, canViewAccount.message));
    }

    // Filter account data based on user role
    const filteredAccount = filterSingleAccountDataByRole(
      account,
      userProfile.roles
    );

    res.status(200).json(
      new ApiRes(
        200,
        {
          account: filteredAccount,
          userRoles: userProfile.roles,
        },
        "Account details retrieved successfully"
      )
    );
  } catch (error) {
    console.error("Get account error:", error);
    return next(new ApiError(500, "Failed to retrieve account details"));
  }
});

// Update account information with role-based permissions
export const UpdateUserAccount = asyncHandler(async (req, res, next) => {
  const userId = req.user;
  const { accountId } = req.params;
  const updates = req.body;

  try {
    // Get user profile to check permissions
    const userProfile = await RoleUserService.getUserCompleteProfile(userId);

    // Define allowed updates based on user roles
    const allowedUpdates = getAllowedUpdatesByRole(userProfile.roles);
    const actualUpdates = {};

    // Filter allowed updates based on user role
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        actualUpdates[key] = updates[key];
      }
    });

    if (Object.keys(actualUpdates).length === 0) {
      return next(new ApiError(400, "No valid fields to update for your role"));
    }

    // Build query based on user role
    let query = { _id: accountId };
    if (!userProfile.roles.includes(ROLE_TYPES.ADMIN)) {
      query.userId = userId;
    }

    // Find and update account
    const account = await Account.findOneAndUpdate(
      query,
      { ...actualUpdates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).select("-__v");

    if (!account) {
      return next(new ApiError(404, "Account not found or access denied"));
    }

    // Log account update for audit (admins and managers)
    if (
      userProfile.roles.includes(ROLE_TYPES.ADMIN) ||
      userProfile.roles.includes(ROLE_TYPES.MANAGER)
    ) {
      console.log(
        `Account ${accountId} updated by user ${userId} with role ${userProfile.roles.join(
          ", "
        )}`
      );
    }

    res
      .status(200)
      .json(new ApiRes(200, { account }, "Account updated successfully"));
  } catch (error) {
    console.error("Update account error:", error);
    return next(new ApiError(500, error.message || "Failed to update account"));
  }
});

// Close/Deactivate user account with role-based restrictions
export const CloseUserAccount = asyncHandler(async (req, res, next) => {
  const userId = req.user;
  const { accountId } = req.params;
  const { reason, transferAccountId } = req.body;

  try {
    // Get user profile to check permissions
    const userProfile = await RoleUserService.getUserCompleteProfile(userId);

    // Build query based on user role
    let query = { _id: accountId };
    if (!userProfile.roles.includes(ROLE_TYPES.ADMIN)) {
      query.userId = userId;
    }

    // Find the account to close
    const account = await Account.findOne(query);

    if (!account) {
      return next(new ApiError(404, "Account not found or access denied"));
    }

    // Role-based account closure validation
    const canCloseAccount = await validateAccountClosureByRole(
      account.accountType,
      userProfile.roles,
      account.userId,
      userId
    );

    if (!canCloseAccount.allowed) {
      return next(new ApiError(403, canCloseAccount.message));
    }

    // Check if account can be closed
    if (account.status === "closed") {
      return next(new ApiError(400, "Account is already closed"));
    }

    // Handle balance transfer if needed
    if (account.balance > 0) {
      if (!transferAccountId) {
        return next(
          new ApiError(
            400,
            "Account has balance. Please specify transfer account or withdraw funds"
          )
        );
      }

      // Verify transfer account exists and user has access
      let transferQuery = { _id: transferAccountId, status: "active" };
      if (!userProfile.roles.includes(ROLE_TYPES.ADMIN)) {
        transferQuery.userId = userId;
      }

      const transferAccount = await Account.findOne(transferQuery);

      if (!transferAccount) {
        return next(
          new ApiError(
            404,
            "Transfer account not found, inactive, or access denied"
          )
        );
      }

      if (transferAccount._id.toString() === accountId) {
        return next(new ApiError(400, "Cannot transfer to the same account"));
      }

      // Transfer remaining balance
      transferAccount.balance += account.balance;
      await transferAccount.save();

      account.balance = 0;
    }

    // Close the account
    account.status = "closed";
    account.updatedAt = Date.now();
    await account.save();

    // Log account closure for audit
    console.log(
      `Account ${accountId} closed by user ${userId} with role ${userProfile.roles.join(
        ", "
      )}`
    );

    res.status(200).json(
      new ApiRes(
        200,
        {
          closedAccount: {
            accountNumber: account.accountNumber,
            accountType: account.accountType,
            finalBalance: 0,
            closedAt: account.updatedAt,
            reason: reason || "Account closure requested by user",
          },
          transferDetails: transferAccountId
            ? {
                transferredTo: transferAccountId,
                amount: account.balance,
              }
            : null,
        },
        "Account closed successfully"
      )
    );
  } catch (error) {
    console.error("Close account error:", error);
    return next(new ApiError(500, error.message || "Failed to close account"));
  }
});

// ROLE-BASED HELPER FUNCTIONS

// Enhanced account creation validation based on user roles
async function validateAccountCreationByRole(
  accountType,
  userRoles,
  userProfile
) {
  // Basic account types available to all authenticated users
  const basicAccountTypes = ["savings", "checking"];

  if (basicAccountTypes.includes(accountType)) {
    return { allowed: true };
  }

  // Role-specific account types
  if (accountType === "loan") {
    if (userRoles.includes(ROLE_TYPES.BORROWER)) {
      // Additional validation for borrowers
      if (
        userProfile.borrowerProfile &&
        userProfile.borrowerProfile.verificationStatus !== "verified"
      ) {
        return {
          allowed: false,
          message:
            "Borrower profile must be verified before creating loan accounts.",
        };
      }
      return { allowed: true };
    }
    return {
      allowed: false,
      message: "Only verified borrowers can create loan accounts.",
    };
  }

  if (accountType === "investment") {
    if (
      userRoles.includes(ROLE_TYPES.LENDER) ||
      userRoles.includes(ROLE_TYPES.ADMIN)
    ) {
      // Additional validation for lenders
      if (
        userRoles.includes(ROLE_TYPES.LENDER) &&
        userProfile.lenderProfile &&
        userProfile.lenderProfile.verificationStatus !== "verified"
      ) {
        return {
          allowed: false,
          message:
            "Lender profile must be verified before creating investment accounts.",
        };
      }
      return { allowed: true };
    }
    return {
      allowed: false,
      message:
        "Only verified lenders and administrators can create investment accounts.",
    };
  }

  if (accountType === "credit") {
    if (
      userRoles.includes(ROLE_TYPES.BORROWER) ||
      userRoles.includes(ROLE_TYPES.LENDER)
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      message: "Credit accounts require borrower or lender role.",
    };
  }

  return { allowed: false, message: "Invalid account type for your role" };
}

// Check account limits based on user role
async function checkAccountLimits(userId, accountType, userRoles) {
  const userAccounts = await Account.find({
    userId,
    accountType,
    status: { $ne: "closed" },
  });

  // Role-based account limits
  const limits = {
    [ROLE_TYPES.USER]: {
      savings: 2,
      checking: 1,
      loan: 0,
      credit: 0,
      investment: 0,
    },
    [ROLE_TYPES.BORROWER]: {
      savings: 3,
      checking: 2,
      loan: 5,
      credit: 2,
      investment: 0,
    },
    [ROLE_TYPES.LENDER]: {
      savings: 5,
      checking: 3,
      loan: 2,
      credit: 3,
      investment: 10,
    },
    [ROLE_TYPES.ADMIN]: {
      savings: 999,
      checking: 999,
      loan: 999,
      credit: 999,
      investment: 999,
    },
  };

  // Get the highest limit based on user roles
  let maxLimit = 0;
  userRoles.forEach((role) => {
    if (limits[role] && limits[role][accountType] > maxLimit) {
      maxLimit = limits[role][accountType];
    }
  });

  if (userAccounts.length >= maxLimit) {
    return {
      allowed: false,
      message: `Maximum ${maxLimit} ${accountType} accounts allowed for your role level.`,
    };
  }

  return { allowed: true };
}

// Validate minimum deposit based on role
function validateMinimumDeposit(accountType, initialDeposit, userRoles) {
  const minimums = {
    savings: userRoles.includes(ROLE_TYPES.LENDER) ? 50 : 100,
    checking: userRoles.includes(ROLE_TYPES.LENDER) ? 25 : 50,
    loan: 0,
    credit: 0,
    investment: userRoles.includes(ROLE_TYPES.ADMIN) ? 0 : 1000,
  };

  const minRequired = minimums[accountType] || 0;

  if (initialDeposit < minRequired) {
    return {
      valid: false,
      message: `Minimum initial deposit for ${accountType} account is ${minRequired} for your role level.`,
    };
  }

  return { valid: true };
}

// Build account filter based on user role
async function buildAccountFilterByRole(
  userId,
  userRoles,
  { status, accountType }
) {
  let filter = {};

  // Admins can see all accounts, others only their own
  if (!userRoles.includes(ROLE_TYPES.ADMIN)) {
    filter.userId = userId;
  }

  if (status) {
    filter.status = status;
  }

  if (accountType) {
    filter.accountType = accountType;
  }

  return filter;
}

// Filter account data based on user role
function filterAccountDataByRole(accounts, userRoles) {
  if (
    userRoles.includes(ROLE_TYPES.ADMIN) ||
    userRoles.includes(ROLE_TYPES.MANAGER)
  ) {
    // Admins and managers see all data
    return accounts;
  }

  // Regular users see limited data
  return accounts.map((account) => ({
    _id: account._id,
    accountNumber: account.accountNumber,
    accountType: account.accountType,
    balance: account.balance,
    currency: account.currency,
    status: account.status,
    interestRate: account.interestRate,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }));
}

// Filter single account data based on user role
function filterSingleAccountDataByRole(account, userRoles) {
  if (
    userRoles.includes(ROLE_TYPES.ADMIN) ||
    userRoles.includes(ROLE_TYPES.MANAGER)
  ) {
    return account;
  }

  // Regular users see limited data
  const filteredAccount = { ...account.toObject() };

  // Remove sensitive fields for non-admin users if needed
  // Currently returning all fields, but you can customize this

  return filteredAccount;
}

// Validate account access based on user role
async function validateAccountAccess(
  accountType,
  userRoles,
  accountOwnerId,
  requestingUserId
) {
  // Admins can access any account
  if (userRoles.includes(ROLE_TYPES.ADMIN)) {
    return { allowed: true };
  }

  // Managers can access accounts within their purview
  if (userRoles.includes(ROLE_TYPES.MANAGER)) {
    return { allowed: true };
  }

  // Users can only access their own accounts
  if (accountOwnerId.toString() !== requestingUserId.toString()) {
    return {
      allowed: false,
      message: "You can only access your own accounts.",
    };
  }

  return { allowed: true };
}

// Get allowed update fields based on user role
function getAllowedUpdatesByRole(userRoles) {
  if (userRoles.includes(ROLE_TYPES.ADMIN)) {
    return ["status", "interestRate", "balance"]; // Admins can update everything
  }

  if (userRoles.includes(ROLE_TYPES.MANAGER)) {
    return ["status", "interestRate"]; // Managers can update status and rates
  }

  // Regular users can only update limited fields
  return ["status"]; // Only status updates for regular users
}

// Validate account closure based on role
async function validateAccountClosureByRole(
  accountType,
  userRoles,
  accountOwnerId,
  requestingUserId
) {
  // Admins can close any account
  if (userRoles.includes(ROLE_TYPES.ADMIN)) {
    return { allowed: true };
  }

  // Users can only close their own accounts
  if (accountOwnerId.toString() !== requestingUserId.toString()) {
    return {
      allowed: false,
      message: "You can only close your own accounts.",
    };
  }

  // Some account types might have restrictions
  if (accountType === "loan") {
    // Additional validation for loan accounts
    const account = await Account.findOne({
      userId: accountOwnerId,
      accountType: "loan",
      balance: { $gt: 0 },
    });

    if (account) {
      return {
        allowed: false,
        message: "Cannot close loan account with outstanding balance.",
      };
    }
  }

  return { allowed: true };
}

// EXISTING HELPER FUNCTIONS (Enhanced)

// Generate unique account number with role-based prefixes
async function generateAccountNumber(accountType) {
  const prefixes = {
    savings: "SAV",
    checking: "CHK",
    loan: "LON",
    credit: "CRD",
    investment: "INV",
  };

  const prefix = prefixes[accountType] || "ACC";
  let accountNumber;
  let isUnique = false;

  while (!isUnique) {
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000);
    accountNumber = `${prefix}${randomDigits}`;

    const existingAccount = await Account.findOne({ accountNumber });
    if (!existingAccount) {
      isUnique = true;
    }
  }

  return accountNumber;
}

// Enhanced interest rate calculation with role-based adjustments
function calculateInterestRate(accountType, userProfile) {
  const baseRates = {
    savings: 3.5,
    checking: 0.5,
    loan: 8.5,
    credit: 18.0,
    investment: 5.0,
  };

  let rate = baseRates[accountType] || 0;

  // Role-based rate adjustments
  if (userProfile.roles.includes(ROLE_TYPES.LENDER)) {
    // Lenders get better rates on savings and investment accounts
    if (accountType === "savings" || accountType === "investment") {
      rate += 0.5;
    }
  }

  if (userProfile.roles.includes(ROLE_TYPES.ADMIN)) {
    // Admins get the best rates
    if (accountType === "savings" || accountType === "investment") {
      rate += 1.0;
    } else if (accountType === "loan" || accountType === "credit") {
      rate -= 1.0;
    }
  }

  // Borrower profile adjustments
  if (userProfile.borrowerProfile) {
    const creditScore = userProfile.borrowerProfile.creditScore;
    if (creditScore && (accountType === "loan" || accountType === "credit")) {
      if (creditScore >= 750) rate -= 1.5;
      else if (creditScore >= 700) rate -= 1.0;
      else if (creditScore >= 650) rate -= 0.5;
      else if (creditScore < 600) rate += 1.5;
    }
  }

  // Lender profile adjustments for investment accounts
  if (userProfile.lenderProfile && accountType === "investment") {
    // Base rate on lender's capacity and success rate
    if (userProfile.lenderProfile.loanSuccessRate >= 90) {
      rate += 0.5;
    }
  }

  return Math.max(0, Math.min(25, rate)); // Ensure rate is between 0% and 25%
}
