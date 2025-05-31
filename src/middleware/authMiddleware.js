// src/middleware/authMiddleware.js - Enhanced OAuth middleware

import passport from "passport";
import { ApiError } from "../helpers/ApiError.js";
import { VerifyAuthToken } from "../utils/tokenUtils.js";
import { ROLE_TYPES } from "../models/Role.js";

// Existing middleware (keep as is)
export const Authenticated = (req, res, next) => {
  const authToken =
    req.cookies.authToken ||
    (req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!authToken) {
    return next(new ApiError(401, "No Token, Authorization Denied :("));
  }

  const decoded = VerifyAuthToken(authToken);

  if (!decoded) {
    return next(new ApiError(401, "Token is not valid! -_-"));
  }

  req.user = decoded.id;
  next();
};

export const jwtAuth = passport.authenticate("jwt", { session: false });

export const googleAuth = (req, res, next) => {
  // Extract role and profile data from query params and store in session
  const {
    role,
    monthlyIncome,
    employmentStatus,
    lendingCapacity,
    interestRatePersonal,
  } = req.query;

  // console.log("Google Auth - Query params:", req.query); // Debug log

  // Store role selection in session for later use in callback
  if (role && Object.values(ROLE_TYPES).includes(role.toUpperCase())) {
    req.session.oauthRole = role.toUpperCase();
    req.session.oauthProfileData = {
      monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
      employmentStatus,
      lendingCapacity: lendingCapacity
        ? parseFloat(lendingCapacity)
        : undefined,
      interestRatePersonal: interestRatePersonal
        ? parseFloat(interestRatePersonal)
        : undefined,
    };

    console.log("Stored in session:", {
      role: req.session.oauthRole,
      profileData: req.session.oauthProfileData,
    }); // Debug log
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
  })(req, res, next);
};

export const googleAuthCallback = (req, res, next) => {
  return passport.authenticate("google", {
    failureRedirect: "http://localhost:7000/auth/login?error=oauth_failed",
    session: false,
  })(req, res, (err) => {
    if (err) {
      console.error("Google OAuth error:", err);
      return next(err);
    }

    console.log("Google callback - Session data:", {
      oauthRole: req.session.oauthRole,
      oauthProfileData: req.session.oauthProfileData,
    }); // Debug log

    // Transfer role data from session to query for callback handler
    if (req.session.oauthRole) {
      req.query.role = req.session.oauthRole;

      // Add profile data based on role
      if (req.session.oauthRole === ROLE_TYPES.BORROWER) {
        req.query.monthlyIncome =
          req.session.oauthProfileData?.monthlyIncome || 0;
        req.query.employmentStatus =
          req.session.oauthProfileData?.employmentStatus || "unemployed";
      } else if (req.session.oauthRole === ROLE_TYPES.LENDER) {
        req.query.lendingCapacity =
          req.session.oauthProfileData?.lendingCapacity || 0;
        req.query.interestRatePersonal =
          req.session.oauthProfileData?.interestRatePersonal || 5;
      }

      // console.log("Transferred to query:", req.query); // Debug log

      // Clean up session
      delete req.session.oauthRole;
      delete req.session.oauthProfileData;
    }

    next();
  });
};

// Enhanced Facebook OAuth middleware with role support
export const facebookAuth = (req, res, next) => {
  // Extract role and profile data from query params and store in session
  const {
    role,
    monthlyIncome,
    employmentStatus,
    lendingCapacity,
    interestRatePersonal,
  } = req.query;

  // console.log("Facebook Auth - Query params:", req.query); // Debug log

  // Store role selection in session for later use in callback
  if (role && Object.values(ROLE_TYPES).includes(role.toUpperCase())) {
    req.session.oauthRole = role.toUpperCase();
    req.session.oauthProfileData = {
      monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
      employmentStatus,
      lendingCapacity: lendingCapacity
        ? parseFloat(lendingCapacity)
        : undefined,
      interestRatePersonal: interestRatePersonal
        ? parseFloat(interestRatePersonal)
        : undefined,
    };

    console.log("Stored in session:", {
      role: req.session.oauthRole,
      profileData: req.session.oauthProfileData,
    }); // Debug log
  }

  return passport.authenticate("facebook", {
    scope: ["email"],
  })(req, res, next);
};

export const facebookAuthCallback = (req, res, next) => {
  return passport.authenticate("facebook", {
    failureRedirect: "http://localhost:7000/auth/login?error=oauth_failed",
    session: false,
  })(req, res, (err) => {
    if (err) {
      console.error("Facebook OAuth error:", err);
      return next(err);
    }

    console.log("Facebook callback - Session data:", {
      oauthRole: req.session.oauthRole,
      oauthProfileData: req.session.oauthProfileData,
    }); // Debug log

    // Transfer role data from session to query for callback handler
    if (req.session.oauthRole) {
      req.query.role = req.session.oauthRole;

      // Add profile data based on role
      if (req.session.oauthRole === ROLE_TYPES.BORROWER) {
        req.query.monthlyIncome =
          req.session.oauthProfileData?.monthlyIncome || 0;
        req.query.employmentStatus =
          req.session.oauthProfileData?.employmentStatus || "unemployed";
      } else if (req.session.oauthRole === ROLE_TYPES.LENDER) {
        req.query.lendingCapacity =
          req.session.oauthProfileData?.lendingCapacity || 0;
        req.query.interestRatePersonal =
          req.session.oauthProfileData?.interestRatePersonal || 5;
      }

      // console.log("Transferred to query:", req.query); // Debug log

      // Clean up session
      delete req.session.oauthRole;
      delete req.session.oauthProfileData;
    }

    next();
  });
};

export const localAuth = passport.authenticate("local", {
  session: false,
});
