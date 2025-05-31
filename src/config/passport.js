// src/config/passport.js - Enhanced with better user creation logic

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import User from "../models/User.js";
import { ConfigENV } from "./index.js";
import RoleUserService from "../utils/roleUserService.js";
import { ROLE_TYPES } from "../models/Role.js";

//local strategy
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email });

        if (!user) {
          return done(null, false, { message: "Incorrect Email! :-:" });
        }

        const IsMatch = await user.comparePassword(password);

        if (!IsMatch) {
          return done(null, false, { message: "Incorrect Password :-:" });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: ConfigENV.JWT_SECRET_ACCESS_TOKEN,
};

//jwt strategy
passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await User.findById(payload.id);

      if (!user) {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  })
);

//Enhanced Google Strategy with role support
passport.use(
  new GoogleStrategy(
    {
      clientID: ConfigENV.GOOGLE_CLIENT_ID,
      clientSecret: ConfigENV.GOOGLE_CLIENT_SECRET,
      callbackURL: ConfigENV.GOOGLE_CALLBACK,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // console.log("Google Profile:", profile);

        // Check if user already exists with Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          return done(null, user);
        }

        // Check if user exists with the same email
        const email =
          profile.emails && profile.emails[0] ? profile.emails[0].value : null;

        if (email) {
          user = await User.findOne({ email });

          if (user) {
            // Update existing user with Google ID
            user.googleId = profile.id;
            await user.save();
            return done(null, user);
          }
        }

        // Create new user with basic USER role
        const userData = {
          name: profile.displayName,
          email: email,
          googleId: profile.id,
        };

        // Register user with default USER role
        user = await RoleUserService.registerUserWithRole(
          userData,
          ROLE_TYPES.USER
        );

        return done(null, user);
      } catch (error) {
        console.error("Google OAuth Error:", error);
        return done(error);
      }
    }
  )
);

// Enhanced Facebook Strategy with role support
passport.use(
  new FacebookStrategy(
    {
      clientID: ConfigENV.FACEBOOK_CLIENT_ID,
      clientSecret: ConfigENV.FACEBOOK_CLIENT_SECRET,
      callbackURL: ConfigENV.FACEBOOK_CALLBACK,
      profileFields: ["id", "displayName", "photos", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // console.log("Facebook Profile:", profile);

        // Check if user already exists with Facebook ID
        let user = await User.findOne({ facebookId: profile.id });

        if (user) {
          return done(null, user);
        }

        // Check if we have an email from Facebook
        const email =
          profile.emails && profile.emails[0] ? profile.emails[0].value : null;

        if (email) {
          // Check if user exists with the same email
          user = await User.findOne({ email });

          if (user) {
            // Update existing user with Facebook ID
            user.facebookId = profile.id;
            await user.save();
            return done(null, user);
          }
        }

        // Create new user with basic USER role
        const userData = {
          name: profile.displayName,
          email: email || `fb_${profile.id}@placeholder.com`, // Use email or create placeholder
          facebookId: profile.id,
        };

        // Register user with default USER role
        user = await RoleUserService.registerUserWithRole(
          userData,
          ROLE_TYPES.USER
        );

        return done(null, user);
      } catch (error) {
        console.error("Facebook OAuth Error:", error);
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
