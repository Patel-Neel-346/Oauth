import express from "express";
import passport from "passport";
import { body, validationResult } from "express-validator";
import { ApiError } from "../helpers/ApiError.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { hasRole, hasPermission } from "../middleware/roleMiddlewareV2.js";
import { ROLE_TYPES } from "../models/Role.js";
import { PERMISSIONS } from "../config/permissions.js";
import {
  SignUp,
  Login,
  GoogleCallback,
  FacebookCallback,
  AuthSuccess,
  RefreshToken,
  Logout,
  GetUserProfile,
  UpdateProfile,
} from "../controller/authController.js";

const router = express.Router();

// Validation middleware
const validateSignUp = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain uppercase, lowercase, number and special character"
    ),
  body("role")
    .optional()
    .isIn(Object.values(ROLE_TYPES))
    .withMessage("Invalid role specified"),
  // Conditional validation for borrower
  body("monthlyIncome")
    .if(body("role").equals(ROLE_TYPES.BORROWER))
    .isNumeric()
    .withMessage("Monthly income must be a number")
    .custom((value) => {
      if (parseFloat(value) < 0) {
        throw new Error("Monthly income cannot be negative");
      }
      return true;
    }),
  body("employmentStatus")
    .if(body("role").equals(ROLE_TYPES.BORROWER))
    .isIn(["employed", "unemployed", "self-employed", "retired"])
    .withMessage("Invalid employment status"),
  // Conditional validation for lender
  body("lendingCapacity")
    .if(body("role").equals(ROLE_TYPES.LENDER))
    .isNumeric()
    .withMessage("Lending capacity must be a number")
    .custom((value) => {
      if (parseFloat(value) < 10000) {
        throw new Error("Minimum lending capacity is 10,000");
      }
      return true;
    }),
  body("interestRatePersonal")
    .if(body("role").equals(ROLE_TYPES.LENDER))
    .isFloat({ min: 3, max: 25 })
    .withMessage("Personal interest rate must be between 3% and 25%"),
];

const validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

const validateProfileUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("contactInfo.phone")
    .optional()
    .isMobilePhone()
    .withMessage("Please provide a valid phone number"),
  body("contactInfo.alternateEmail")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid alternate email"),
  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date of birth")
    .custom((value) => {
      const age = new Date().getFullYear() - new Date(value).getFullYear();
      if (age < 18) {
        throw new Error("Must be at least 18 years old");
      }
      return true;
    }),
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
    return next(new ApiError(400, "Validation failed", errors.array()));
  }
  next();
};

// Public Routes
router.post("/signup", validateSignUp, handleValidationErrors, SignUp);
router.post("/login", validateLogin, handleValidationErrors, Login);
router.post("/refresh-token", RefreshToken);

// OAuth Routes
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    // You can pass state parameter for role selection
    state: JSON.stringify({ role: "user" }),
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/auth/error?provider=google`,
  }),
  GoogleCallback
);

router.get(
  "/facebook",
  passport.authenticate("facebook", {
    scope: ["email"],
    state: JSON.stringify({ role: "user" }),
  })
);

router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    failureRedirect: `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/auth/error?provider=facebook`,
  }),
  FacebookCallback
);

// OAuth success endpoint
router.get("/success", AuthSuccess);

// Protected Routes
router.use(authenticate); // All routes below require authentication

router.post("/logout", Logout);
router.get("/profile", GetUserProfile);
router.put(
  "/profile",
  validateProfileUpdate,
  handleValidationErrors,
  UpdateProfile
);

// Role-specific routes
router.get("/dashboard/user", hasRole([ROLE_TYPES.USER]), (req, res) => {
  res.json({
    success: true,
    message: "Welcome to User Dashboard",
    user: req.userProfile,
  });
});

router.get(
  "/dashboard/borrower",
  hasRole([ROLE_TYPES.BORROWER]),
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome to Borrower Dashboard",
      profile: req.userProfile.borrowerProfile,
    });
  }
);

router.get("/dashboard/lender", hasRole([ROLE_TYPES.LENDER]), (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Lender Dashboard",
    profile: req.userProfile.lenderProfile,
  });
});

router.get(
  "/dashboard/manager",
  hasRole([ROLE_TYPES.MANAGER]),
  hasPermission(PERMISSIONS.ADMIN_DASHBOARD),
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome to Manager Dashboard",
      permissions: req.userPermissions,
    });
  }
);

router.get(
  "/dashboard/admin",
  hasRole([ROLE_TYPES.ADMIN]),
  hasPermission(PERMISSIONS.ADMIN_DASHBOARD),
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome to Admin Dashboard",
      permissions: req.userPermissions,
    });
  }
);

// Admin-only user management routes
router.get(
  "/users",
  hasPermission(PERMISSIONS.USER_READ_ALL),
  async (req, res, next) => {
    try {
      // Implementation for getting all users
      res.json({ message: "Get all users endpoint" });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/users/:userId/suspend",
  hasPermission(PERMISSIONS.USER_SUSPEND),
  async (req, res, next) => {
    try {
      // Implementation for suspending a user
      res.json({ message: "User suspended successfully" });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/users/:userId/activate",
  hasPermission(PERMISSIONS.USER_ACTIVATE),
  async (req, res, next) => {
    try {
      // Implementation for activating a user
      res.json({ message: "User activated successfully" });
    } catch (error) {
      next(error);
    }
  }
);

// Role assignment routes (Admin only)
router.post(
  "/users/:userId/roles",
  hasPermission([PERMISSIONS.USER_UPDATE_ALL]),
  async (req, res, next) => {
    try {
      // Implementation for assigning roles to users
      const { userId } = req.params;
      const { role, profileData } = req.body;

      // Add role assignment logic here
      res.json({
        message: "Role assigned successfully",
        userId,
        role,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Password change route
router.put(
  "/change-password",
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters long")
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      )
      .withMessage(
        "New password must contain uppercase, lowercase, number and special character"
      ),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Passwords don't match");
      }
      return true;
    }),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      // Implementation for password change
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
