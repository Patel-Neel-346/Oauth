import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ROLE_TYPES } from "./Role.js";

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: false,
  },
  accountNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  status: {
    type: String,
    enum: ["active", "suspended", "pending", "closed"],
    default: "pending",
  },

  contactInfo: {
    phone: String,
    alternateEmail: String,
  },

  dateOfBirth: Date,

  googleId: {
    type: String,
    default: null,
  },

  facebookId: {
    type: String,
    default: null,
  },

  refreshToken: {
    type: String,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

UserSchema.pre("save", async function (next) {
  this.updatedAt = Date.now();

  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  // Generate account number for new users with borrower role
  if (
    this.isNew &&
    !this.accountNumber &&
    (this.defaultRole === ROLE_TYPES.USER ||
      this.defaultRole === ROLE_TYPES.BORROWER)
  ) {
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
    this.accountNumber = `ACC${randomDigits}`;
    // console.log(this.accountNumber);
  }

  next();
});

// Compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user has a specific role
UserSchema.methods.hasRole = function (roleName) {
  return this.roles.some((role) => role.name === roleName);
};

const User = mongoose.model("User", UserSchema);

export default User;

// Hash password before save
