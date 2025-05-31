// src/utils/roleUserService.js
import User from "../models/User.js";
import { Role, ROLE_TYPES } from "../models/Role.js";
import BorrowerProfile from "../models/BorrowerProfile.js";
import LenderProfile from "../models/LenderProfile.js";
import { ApiError } from "../helpers/ApiError.js";

class RoleUserService {
  static async getUserCompleteProfile(userId) {
    try {
      // Get basic user information
      const user = await User.findById(userId).select(
        "-password -refreshToken"
      );
      if (!user) {
        throw new ApiError(404, "User not found");
      }

      // Get roles assigned to the user
      const roles = await Role.find({ users: userId });
      if (!roles || roles.length === 0) {
        return { user, roles: [] };
      }

      // Extract role names
      const roleNames = roles.map((role) => role.name);

      // Create profile object
      const profile = { user, roles: roleNames };

      // Get role-specific profiles if they exist
      if (roleNames.includes(ROLE_TYPES.BORROWER)) {
        const borrowerRole = roles.find((r) => r.name === ROLE_TYPES.BORROWER);
        const borrowerProfile = await BorrowerProfile.findOne({
          roleId: borrowerRole._id,
        });
        if (borrowerProfile) {
          profile.borrowerProfile = borrowerProfile;
        }
      }

      if (roleNames.includes(ROLE_TYPES.LENDER)) {
        const lenderRole = roles.find((r) => r.name === ROLE_TYPES.LENDER);
        const lenderProfile = await LenderProfile.findOne({
          roleId: lenderRole._id,
        });
        if (lenderProfile) {
          profile.lenderProfile = lenderProfile;
        }
      }

      return profile;
    } catch (error) {
      throw error;
    }
  }

  static async assignRoleToUser(userId, roleName, profileData = {}) {
    try {
      // console.log(
      //   `Assigning role ${roleName} to user ${userId} with profile data:`,
      //   profileData
      // );

      // Validate role name
      if (!Object.values(ROLE_TYPES).includes(roleName)) {
        throw new ApiError(400, "Invalid role type");
      }

      // Get or create the role
      let role = await Role.findOne({ name: roleName });
      if (!role) {
        // Create the role if it doesn't exist
        role = await Role.create({
          name: roleName,
          description: `${
            roleName.charAt(0).toUpperCase() + roleName.slice(1)
          } role`,
        });
      }

      // Check if user already has this role
      if (role.users.includes(userId)) {
        // console.log(`User already has the ${roleName} role`);
        return { role, profile: null };
      }

      // Add user to role
      role.users.push(userId);
      await role.save();

      let roleProfile = null;

      // Create role-specific profile based on role type
      if (
        roleName === ROLE_TYPES.BORROWER &&
        Object.keys(profileData).length > 0
      ) {
        // console.log("Creating borrower profile with data:", profileData);
        roleProfile = await BorrowerProfile.create({
          roleId: role._id,
          ...profileData,
        });
        // console.log("Created borrower profile:", roleProfile);
      } else if (
        roleName === ROLE_TYPES.LENDER &&
        Object.keys(profileData).length > 0
      ) {
        // console.log("Creating lender profile with data:", profileData);
        roleProfile = await LenderProfile.create({
          roleId: role._id,
          ...profileData,
        });
        // console.log("Created lender profile:", roleProfile);
      }

      return { role, profile: roleProfile };
    } catch (error) {
      console.error("Error in assignRoleToUser:", error);
      throw error;
    }
  }

  static async registerUserWithRole(userData, roleName, profileData = {}) {
    try {
      // console.log(
      //   `Registering user with role: ${roleName} and profile data:`,
      //   profileData
      // );

      // Create the user
      const user = await User.create(userData);

      //generate User Account Number  Right now its test Case for Only when i create User Account,etc there i will Created Account number for all User
      if (!user.accountNumber) {
        const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
        user.accountNumber = `ACC${randomDigits}`;
        await user.save(); // Save the account number
        // console.log("Generated account number:", user.accountNumber);
      }

      // Assign default USER role first
      await this.assignRoleToUser(user._id, ROLE_TYPES.USER);

      // If additional role is specified, assign that as well
      if (roleName && roleName !== ROLE_TYPES.USER) {
        // console.log(`Assigning additional role: ${roleName}`);
        await this.assignRoleToUser(user._id, roleName, profileData);
      }

      return user;
    } catch (error) {
      console.error("Error in registerUserWithRole:", error);
      // If there was an error, try to delete the partially created user
      if (error.code !== 11000) {
        const user = await User.findOne({ email: userData.email });
        if (user) {
          await User.deleteOne({ _id: user._id });
        }
      }
      throw error;
    }
  }
}

export default RoleUserService;
