import { ApiError } from "../helpers/ApiError.js";
import { ApiRes } from "../helpers/ApiRespones.js";
import User from "../models/User.js";
import { ROLE_TYPES } from "../models/Role.js";
import RoleUserService from "../utils/roleUserService.js";
import { asyncHandler } from "../helpers/asyncHandler.js";
import {
  generateAuthToken,
  generateRefreshToken,
  VerifyRefreshToken,
} from "../utils/tokenUtils.js";
import { BANKING_RULES } from "../config/permissions.js";

// Regular Sign Up
export const SignUp = asyncHandler(async (req, res, next) => {
  const { name, email, password, role, ...additionalData } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    return next(new ApiError(400, "Name, email, and password are required"));
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ApiError(400, "User already exists with this email"));
  }

  try {
    const userData = { name, email, password };
    const selectedRole = role || ROLE_TYPES.USER;

    // Validate role
    if (!Object.values(ROLE_TYPES).includes(selectedRole)) {
      return next(new ApiError(400, "Invalid role specified"));
    }

    // Extract and validate role-specific profile data
    const profileData = extractRoleProfileData(selectedRole, additionalData);

    // Register user with role and profile
    const user = await RoleUserService.registerUserWithRole(
      userData,
      selectedRole,
      profileData
    );

    // Generate tokens
    const authToken = generateAuthToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Set secure cookies
    setAuthCookies(res, authToken, refreshToken);

    // Get complete user profile
    const userProfile = await RoleUserService.getUserCompleteProfile(user._id);

    res.status(201).json(
      new ApiRes(
        201,
        {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            accountNumber: user.accountNumber,
            status: user.status,
          },
          authToken,
          roles: userProfile.roles,
          lenderProfile: userProfile.lenderProfile || null,
          borrowerProfile: userProfile.borrowerProfile || null,
        },
        "User registered successfully"
      )
    );
  } catch (error) {
    console.error("Registration error:", error);
    return next(new ApiError(500, error.message || "Registration failed"));
  }
});

// Regular Login
export const Login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return next(new ApiError(400, "Email and password are required"));
  }

  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    return next(new ApiError(401, "Invalid email or password"));
  }

  // Check if user has a password (OAuth users might not have one)
  if (!user.password) {
    return next(new ApiError(401, "Please login with your social account"));
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return next(new ApiError(401, "Invalid email or password"));
  }

  // Check account status
  if (user.status === "suspended") {
    return next(new ApiError(403, "Account is suspended. Contact support"));
  }

  if (user.status === "closed") {
    return next(new ApiError(403, "Account is closed. Contact support"));
  }

  // Get complete user profile
  const userProfile = await RoleUserService.getUserCompleteProfile(user._id);

  // Generate tokens
  const authToken = generateAuthToken(user);
  const refreshToken = generateRefreshToken(user);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  // Set secure cookies
  setAuthCookies(res, authToken, refreshToken);

  // Return response
  res.status(200).json(
    new ApiRes(
      200,
      {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          accountNumber: user.accountNumber,
          status: user.status,
        },
        authToken,
        roles: userProfile.roles,
        lenderProfile: userProfile.lenderProfile || null,
        borrowerProfile: userProfile.borrowerProfile || null,
      },
      "Login successful"
    )
  );
});

// Google OAuth Callback
export const GoogleCallback = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const { role, ...profileData } = req.query;

  try {
    await handleOAuthCallback(user, role, profileData, "google");

    // Generate tokens
    const authToken = generateAuthToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Set secure cookies
    setAuthCookies(res, authToken, refreshToken);

    // Redirect to success page
    const redirectUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/auth/success?provider=google`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Google OAuth error:", error);
    const errorUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/auth/error?provider=google&error=${encodeURIComponent(error.message)}`;
    res.redirect(errorUrl);
  }
});

// Facebook OAuth Callback
export const FacebookCallback = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const { role, ...profileData } = req.query;

  try {
    await handleOAuthCallback(user, role, profileData, "facebook");

    // Generate tokens
    const authToken = generateAuthToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Set secure cookies
    setAuthCookies(res, authToken, refreshToken);

    // Redirect to success page
    const redirectUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/auth/success?provider=facebook`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Facebook OAuth error:", error);
    const errorUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/auth/error?provider=facebook&error=${encodeURIComponent(error.message)}`;
    res.redirect(errorUrl);
  }
});

// OAuth Success Handler
export const AuthSuccess = asyncHandler(async (req, res, next) => {
  const { provider } = req.query;

  // Get user info from cookies/session
  const authToken = req.cookies.authToken;

  if (!authToken) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Authentication failed - no token found"));
  }

  // You can decode the token to get user info if needed
  res.status(200).json(
    new ApiRes(200, {
      success: true,
      message: `${provider} authentication successful`,
      redirectTo: "/dashboard",
    })
  );
});

// Refresh Token
export const RefreshToken = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return next(new ApiError(401, "Refresh token not found"));
  }

  // Verify refresh token
  const decoded = VerifyRefreshToken(refreshToken);
  if (!decoded) {
    return next(new ApiError(401, "Invalid or expired refresh token"));
  }

  // Find user with this refresh token
  const user = await User.findOne({
    _id: decoded.id,
    refreshToken: refreshToken,
  });

  if (!user) {
    return next(new ApiError(401, "User not found or token revoked"));
  }

  // Check account status
  if (user.status === "suspended" || user.status === "closed") {
    return next(new ApiError(403, "Account access restricted"));
  }

  // Generate new tokens
  const newAuthToken = generateAuthToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Update refresh token in database
  user.refreshToken = newRefreshToken;
  await user.save();

  // Set new cookies
  setAuthCookies(res, newAuthToken, newRefreshToken);

  res
    .status(200)
    .json(
      new ApiRes(
        200,
        { authToken: newAuthToken },
        "Token refreshed successfully"
      )
    );
});

// Logout
export const Logout = asyncHandler(async (req, res, next) => {
  try {
    const user = await User.findById(req.user);

    if (user) {
      // Clear the refresh token in the database
      user.refreshToken = null;
      await user.save();
    }

    // Clear cookies
    res.clearCookie("refreshToken");
    res.clearCookie("authToken");

    res.status(200).json(new ApiRes(200, null, "Successfully logged out"));
  } catch (error) {
    next(new ApiError(500, "Logout failed"));
  }
});

// Get User Profile
export const GetUserProfile = asyncHandler(async (req, res, next) => {
  try {
    const userProfile = await RoleUserService.getUserCompleteProfile(req.user);

    if (!userProfile.user) {
      return next(new ApiError(404, "User not found"));
    }

    res.status(200).json(
      new ApiRes(200, {
        user: {
          _id: userProfile.user._id,
          name: userProfile.user.name,
          email: userProfile.user.email,
          accountNumber: userProfile.user.accountNumber,
          status: userProfile.user.status,
          contactInfo: userProfile.user.contactInfo,
          dateOfBirth: userProfile.user.dateOfBirth,
          createdAt: userProfile.user.createdAt,
        },
        roles: userProfile.roles,
        lenderProfile: userProfile.lenderProfile || null,
        borrowerProfile: userProfile.borrowerProfile || null,
      })
    );
  } catch (error) {
    next(new ApiError(500, "Failed to get user profile"));
  }
});

// Update User Profile
export const UpdateProfile = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user;
    const { name, contactInfo, dateOfBirth } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return next(new ApiError(404, "User not found"));
    }

    // Update allowed fields
    if (name) user.name = name;
    if (contactInfo) user.contactInfo = { ...user.contactInfo, ...contactInfo };
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;

    await user.save();

    const userProfile = await RoleUserService.getUserCompleteProfile(userId);

    res.status(200).json(
      new ApiRes(
        200,
        {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            accountNumber: user.accountNumber,
            status: user.status,
            contactInfo: user.contactInfo,
            dateOfBirth: user.dateOfBirth,
          },
          roles: userProfile.roles,
        },
        "Profile updated successfully"
      )
    );
  } catch (error) {
    next(new ApiError(500, "Failed to update profile"));
  }
});

// Helper Functions
function extractRoleProfileData(role, additionalData) {
  let profileData = {};

  if (role === ROLE_TYPES.BORROWER) {
    const { monthlyIncome, employmentStatus, creditScore } = additionalData;
    profileData = {
      monthlyIncome: parseFloat(monthlyIncome) || 0,
      employmentStatus: employmentStatus || "unemployed",
      creditScore: parseInt(creditScore) || 700,
      totalDebt: 0,
      verificationStatus: "pending",
    };
  } else if (role === ROLE_TYPES.LENDER) {
    const { lendingCapacity, interestRatePersonal } = additionalData;
    const personalRate = parseFloat(interestRatePersonal) || 5;
    profileData = {
      lendingCapacity: parseFloat(lendingCapacity) || 0,
      availableFunds: parseFloat(lendingCapacity) || 0,
      interestRate: {
        personal: personalRate,
        business: personalRate + 1.5,
        home: Math.max(personalRate - 1, 3), // Minimum 3%
      },
      verificationStatus: "pending",
    };
  }

  return profileData;
}

async function handleOAuthCallback(user, role, profileData, provider) {
  // Check if user already has roles
  const existingProfile = await RoleUserService.getUserCompleteProfile(
    user._id
  );

  // If user is new or only has USER role, and a specific role is requested
  if (role && Object.values(ROLE_TYPES).includes(role.toUpperCase())) {
    const requestedRole = role.toUpperCase();

    // Only assign role if user doesn't already have it
    if (!existingProfile.roles.includes(requestedRole)) {
      const roleProfileData = extractRoleProfileData(
        requestedRole,
        profileData
      );

      await RoleUserService.assignRoleToUser(
        user._id,
        requestedRole,
        roleProfileData
      );
    }
  }

  // Activate user account if it's pending
  if (user.status === "pending") {
    user.status = "active";
    await user.save();
  }
}

function setAuthCookies(res, authToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.cookie("authToken", authToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 60 * 60 * 1000, // 1 hour
  });
}
