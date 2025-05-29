import { ApiError } from "../helpers/ApiError.js";
import Role from "../models/Role.js";
import { ROLE_TYPES } from "../models/Role.js";

// Simple role check middleware - this is all you need
export const hasRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user;

      if (!userId) {
        return next(new ApiError(401, "Authentication required"));
      }

      // Get user roles from database - only fetch role names
      const userRoles = await Role.find({ users: userId }).select("name");

      if (!userRoles || userRoles.length === 0) {
        return next(new ApiError(403, "No roles assigned to user"));
      }

      // Extract role names from the query result
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

      next();
    } catch (error) {
      console.error("Role check error:", error);
      return next(new ApiError(500, "Error checking user permissions"));
    }
  };
};

// Export role constants for easy access
export { ROLE_TYPES };
