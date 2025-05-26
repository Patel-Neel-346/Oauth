import express from "express";
import {
  SignUp,
  Login,
  RefreshToken,
  Logout,
  GetUserProfile,
  AuthSuccess,
  GoogleCallback,
  FacebookCallback,
} from "../controller/authController.js";
import {
  Authenticated,
  googleAuth,
  googleAuthCallback,
  facebookAuth,
  facebookAuthCallback,
} from "../middleware/authMiddleware.js";
import { hasRole } from "../middleware/roleMiddleware.js";
import { ROLE_TYPES } from "../models/Role.js";

import {
  loginValidationRules,
  registerValidationRules,
} from "../middleware/authValidator.js";

const AuthRouter = express.Router();

AuthRouter.post("/register", registerValidationRules, SignUp);

AuthRouter.post("/login", loginValidationRules, Login);

AuthRouter.post("/logout", Authenticated, Logout);

AuthRouter.get("/refresh-token", RefreshToken);

AuthRouter.get("/profile", Authenticated, GetUserProfile);

AuthRouter.get("/google/callback", googleAuthCallback, GoogleCallback);

AuthRouter.get("/facebook/callback", facebookAuthCallback, FacebookCallback);

AuthRouter.get("/success", AuthSuccess);

AuthRouter.post("/role", Authenticated, async (req, res, next) => {
  try {
    const { role, ...profileData } = req.body;

    if (!role || !Object.values(ROLE_TYPES).includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }

    // Use the RoleUserService to assign the role
    const result = await RoleUserService.assignRoleToUser(
      req.user,
      role,
      profileData
    );

    res.status(200).json({
      success: true,
      message: `${role} role added successfully`,
      data: { role: result.role },
    });
  } catch (error) {
    next(error);
  }
});

AuthRouter.get("/google", googleAuth);

AuthRouter.get("/facebook", facebookAuth);

export default AuthRouter;
