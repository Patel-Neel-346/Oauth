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

export const SignUp = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return next(new ApiError(400, "All fields are required"));
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ApiError(400, "User already exists with this email"));
  }

  try {
    const userData = { name, email, password };
    const roleName = role || ROLE_TYPES.USER;

    // Extract profile data based on role
    let profileData = {};

    if (roleName === ROLE_TYPES.BORROWER) {
      const { monthlyIncome, employmentStatus } = req.body;
      profileData = {
        monthlyIncome: parseFloat(monthlyIncome) || 0,
        employmentStatus: employmentStatus || "unemployed",
        creditScore: 700,
        totalDebt: 0,
      };
    } else if (roleName === ROLE_TYPES.LENDER) {
      const { lendingCapacity, interestRatePersonal } = req.body;
      profileData = {
        lendingCapacity: parseFloat(lendingCapacity) || 0,
        availableFunds: parseFloat(lendingCapacity) || 0,
        interestRate: {
          personal: parseFloat(interestRatePersonal) || 5,
          business: parseFloat(interestRatePersonal) + 1.5 || 6.5,
          home: parseFloat(interestRatePersonal) - 1 || 4,
        },
      };
    }

    // Register user with role and profile
    const user = await RoleUserService.registerUserWithRole(
      userData,
      roleName,
      profileData
    );

    // console.log(user);

    const authToken = generateAuthToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("authToken", authToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000,
    });

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
    };

    res.status(201).json(
      new ApiRes(
        201,
        {
          user: userResponse,
          authToken,
          role: roleName,
        },
        "User registered successfully"
      )
    );
  } catch (error) {
    console.error("Registration error:", error);
    return next(new ApiError(500, error.message || "Registration failed"));
  }
});

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

  // Check if user has a password (could be OAuth user without password)
  if (!user.password) {
    return next(new ApiError(401, "Please login with your social account"));
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return next(new ApiError(401, "Invalid email or password"));
  }

  // Get complete user profile with roles
  const userProfile = await RoleUserService.getUserCompleteProfile(user._id);

  // Generate tokens
  const authToken = generateAuthToken(user);
  const refreshToken = generateRefreshToken(user);

  // Save refresh token to user
  user.refreshToken = refreshToken;
  await user.save();

  // Set cookies
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.cookie("authToken", authToken, {
    httpOnly: true,
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  // Return response with roles
  const userWithoutPassword = {
    _id: user._id,
    name: user.name,
    email: user.email,
    roles: userProfile.roles || [],
  };

  res.status(200).json(
    new ApiRes(
      200,
      {
        user: userWithoutPassword,
        authToken,
        lenderProfile: userProfile.lenderProfile || null,
        borrowerProfile: userProfile.borrowerProfile || null,
      },
      "Login successful"
    )
  );
});

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

  // Generate new tokens
  const newAuthToken = generateAuthToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Update refresh token in database
  user.refreshToken = newRefreshToken;
  await user.save();

  // Set new cookies
  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.cookie("authToken", newAuthToken, {
    httpOnly: true,
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  res.status(200).json(
    new ApiRes(
      200,
      {
        authToken: newAuthToken,
      },
      "Token refreshed successfully"
    )
  );
});

// Logout user
export const Logout = asyncHandler(async (req, res, next) => {
  try {
    const user = await User.findById(req.user);

    if (!user) {
      return next(new ApiError(404, "User not found"));
    }

    // Clear the refresh token in the database
    user.refreshToken = null;
    await user.save();

    // Clear cookies
    res.clearCookie("refreshToken");
    res.clearCookie("authToken");

    res.status(200).json(new ApiRes(200, null, "Successfully logged out"));
  } catch (error) {
    next(new ApiError(500, "Logout failed"));
  }
});

// Get user profile
export const GetUserProfile = asyncHandler(async (req, res, next) => {
  try {
    // Get complete user profile with roles
    const userProfile = await RoleUserService.getUserCompleteProfile(req.user);

    if (!userProfile.user) {
      return next(new ApiError(404, "User not found"));
    }

    res.status(200).json(
      new ApiRes(200, {
        user: userProfile.user,
        roles: userProfile.roles,
        lenderProfile: userProfile.lenderProfile || null,
        borrowerProfile: userProfile.borrowerProfile || null,
      })
    );
  } catch (error) {
    next(new ApiError(500, "Failed to get user profile"));
  }
});

export const GoogleCallback = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const { role, ...profileData } = req.query; // Get role from query params

  try {
    // Check if this is a new user (just created) or existing user
    const existingRoles = await RoleUserService.getUserCompleteProfile(
      user._id
    );

    // If user has no roles or only has USER role, and a specific role is requested
    if (role && Object.values(ROLE_TYPES).includes(role.toUpperCase())) {
      const requestedRole = role.toUpperCase();

      // Only assign role if user doesn't already have it
      if (!existingRoles.roles.includes(requestedRole)) {
        // Prepare profile data based on role type
        let roleProfileData = {};

        if (requestedRole === ROLE_TYPES.BORROWER) {
          roleProfileData = {
            monthlyIncome: parseFloat(profileData.monthlyIncome) || 0,
            employmentStatus: profileData.employmentStatus || "unemployed",
            creditScore: 700, // Default credit score
            totalDebt: 0, // Default total debt
          };
        } else if (requestedRole === ROLE_TYPES.LENDER) {
          const personalRate =
            parseFloat(profileData.interestRatePersonal) || 5;
          roleProfileData = {
            lendingCapacity: parseFloat(profileData.lendingCapacity) || 0,
            availableFunds: parseFloat(profileData.lendingCapacity) || 0,
            interestRate: {
              personal: personalRate,
              business: personalRate + 1.5,
              home: personalRate - 1,
            },
          };
        }

        await RoleUserService.assignRoleToUser(
          user._id,
          requestedRole,
          roleProfileData
        );
      }
    }

    // Generate tokens
    const authToken = generateAuthToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to user
    user.refreshToken = refreshToken;
    await user.save();

    // Set cookies
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.cookie("authToken", authToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000, // 1 hour
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    // Get updated user profile with roles
    const updatedProfile = await RoleUserService.getUserCompleteProfile(
      user._id
    );

    // Redirect to frontend with success and role info
    const redirectUrl = role
      ? `http://localhost:7000/auth/success?token=${authToken}&role=${role}&newUser=${!existingRoles
          .roles.length}`
      : `http://localhost:7000/auth/success?token=${authToken}`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Google OAuth role assignment error:", error);
    // Redirect to error page or login with error message
    res.redirect(
      `http://localhost:7000/auth/login?error=role_assignment_failed`
    );
  }
});

// Updated Facebook OAuth callback
export const FacebookCallback = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const { role, ...profileData } = req.query; // Get role from query params

  try {
    // Check if this is a new user (just created) or existing user
    const existingRoles = await RoleUserService.getUserCompleteProfile(
      user._id
    );

    // If user has no roles or only has USER role, and a specific role is requested
    if (role && Object.values(ROLE_TYPES).includes(role.toUpperCase())) {
      const requestedRole = role.toUpperCase();

      // Only assign role if user doesn't already have it
      if (!existingRoles.roles.includes(requestedRole)) {
        // Prepare profile data based on role type
        let roleProfileData = {};

        if (requestedRole === ROLE_TYPES.BORROWER) {
          roleProfileData = {
            monthlyIncome: parseFloat(profileData.monthlyIncome) || 0,
            employmentStatus: profileData.employmentStatus || "unemployed",
            creditScore: 700, // Default credit score
            totalDebt: 0, // Default total debt
          };
        } else if (requestedRole === ROLE_TYPES.LENDER) {
          const personalRate =
            parseFloat(profileData.interestRatePersonal) || 5;
          roleProfileData = {
            lendingCapacity: parseFloat(profileData.lendingCapacity) || 0,
            availableFunds: parseFloat(profileData.lendingCapacity) || 0,
            interestRate: {
              personal: personalRate,
              business: personalRate + 1.5,
              home: personalRate - 1,
            },
          };
        }

        await RoleUserService.assignRoleToUser(
          user._id,
          requestedRole,
          roleProfileData
        );
      }
    }

    // Generate tokens
    const authToken = generateAuthToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to user
    user.refreshToken = refreshToken;
    await user.save();

    // Set cookies
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.cookie("authToken", authToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000, // 1 hour
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    // Get updated user profile with roles
    const updatedProfile = await RoleUserService.getUserCompleteProfile(
      user._id
    );

    // Redirect to frontend with success and role info
    const redirectUrl = role
      ? `http://localhost:7000/auth/success?token=${authToken}&role=${role}&newUser=${!existingRoles
          .roles.length}`
      : `http://localhost:7000/auth/success?token=${authToken}`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Facebook OAuth role assignment error:", error);
    // Redirect to error page or login with error message
    res.redirect(
      `http://localhost:7000/auth/login?error=role_assignment_failed`
    );
  }
});

export const AuthSuccess = asyncHandler(async (req, res, next) => {
  const { token, role, newUser } = req.query;

  if (!token) {
    return res
      .status(400)
      .json(new ApiRes(400, null, "Authentication token not found"));
  }

  // You can customize this response based on your frontend needs
  res.status(200).json(
    new ApiRes(200, {
      success: true,
      message: "Authentication successful",
      token,
      role: role || null,
      isNewUser: newUser === "true",
    })
  );
});
