// // src/controller/TransactionController.js
// import { asyncHandler } from "../helpers/asyncHandler.js";
// import { ApiError } from "../helpers/ApiError.js";
// import { ApiRes } from "../helpers/ApiRespones.js";
// import TransactionService from "../utils/AccountService.js";
// import Account from "../models/Account.js";
// import RoleUserService from "../utils/roleUserService.js";
// import { ROLE_TYPES } from "../models/Role.js";
// import Transaction from "../models/Transaction.js";

// // Deposit funds to user's account
// export const depositFunds = asyncHandler(async (req, res, next) => {
//   const { accountId, amount, description } = req.body;
//   const userId = req.user;

//   try {
//     // Verify account belongs to user
//     console.log(accountId);

//     // const account = await Account.findOne({ _id: accountId, userId });
//     const account = await Account.findById(accountId);
//     console.log(account);
//     if (!account) {
//       return next(new ApiError(404, "Account not found or access denied"));
//     }

//     const result = await TransactionService.depositFunds(
//       accountId,
//       parseFloat(amount),
//       description || "Deposit",
//       { initiatedBy: userId }
//     );

//     res
//       .status(200)
//       .json(new ApiRes(200, result, "Deposit completed successfully"));
//   } catch (error) {
//     console.error("Deposit error:", error);
//     return next(new ApiError(error.statusCode || 500, error.message));
//   }
// });

// // Withdraw funds from user's account
// export const withdrawFunds = asyncHandler(async (req, res, next) => {
//   const { accountId, amount, description } = req.body;
//   const userId = req.user;

//   try {
//     // Verify account belongs to user
//     const account = await Account.findOne({ _id: accountId, userId });
//     if (!account) {
//       return next(new ApiError(404, "Account not found or access denied"));
//     }

//     const result = await TransactionService.withdrawFunds(
//       accountId,
//       parseFloat(amount),
//       description || "Withdrawal",
//       { initiatedBy: userId }
//     );

//     res
//       .status(200)
//       .json(new ApiRes(200, result, "Withdrawal completed successfully"));
//   } catch (error) {
//     console.error("Withdrawal error:", error);
//     return next(new ApiError(error.statusCode || 500, error.message));
//   }
// });

// // Transfer funds between accounts
// export const transferFunds = asyncHandler(async (req, res, next) => {
//   const { fromAccountId, toAccountId, amount, description } = req.body;
//   const userId = req.user;

//   try {
//     // Verify source account belongs to user
//     const fromAccount = await Account.findOne({ _id: fromAccountId, userId });
//     if (!fromAccount) {
//       return next(
//         new ApiError(404, "Source account not found or access denied")
//       );
//     }

//     // Verify destination account exists (can belong to any user)
//     const toAccount = await Account.findById(toAccountId);
//     if (!toAccount) {
//       return next(new ApiError(404, "Destination account not found"));
//     }

//     const result = await TransactionService.transferFunds(
//       fromAccountId,
//       toAccountId,
//       parseFloat(amount),
//       description || "Transfer",
//       { initiatedBy: userId }
//     );

//     res
//       .status(200)
//       .json(new ApiRes(200, result, "Transfer completed successfully"));
//   } catch (error) {
//     console.error("Transfer error:", error);
//     return next(new ApiError(error.statusCode || 500, error.message));
//   }
// });

// // Transfer funds by account number (more user-friendly)
// export const transferByAccountNumber = asyncHandler(async (req, res, next) => {
//   const { fromAccountId, toAccountNumber, amount, description } = req.body;
//   const userId = req.user;

//   try {
//     // Verify source account belongs to user
//     const fromAccount = await Account.findOne({ _id: fromAccountId, userId });
//     if (!fromAccount) {
//       return next(
//         new ApiError(404, "Source account not found or access denied")
//       );
//     }

//     // Find destination account by account number
//     const toAccount = await Account.findOne({ accountNumber: toAccountNumber });
//     if (!toAccount) {
//       return next(new ApiError(404, "Destination account not found"));
//     }

//     const result = await TransactionService.transferFunds(
//       fromAccountId,
//       toAccount._id,
//       parseFloat(amount),
//       description || "Transfer",
//       {
//         initiatedBy: userId,
//         transferMethod: "accountNumber",
//         destinationAccountNumber: toAccountNumber,
//       }
//     );

//     res
//       .status(200)
//       .json(new ApiRes(200, result, "Transfer completed successfully"));
//   } catch (error) {
//     console.error("Transfer by account number error:", error);
//     return next(new ApiError(error.statusCode || 500, error.message));
//   }
// });

// // Get account balance and recent transactions
// export const getAccountBalance = asyncHandler(async (req, res, next) => {
//   const { accountId } = req.params;
//   const { limit = 10 } = req.query;
//   const userId = req.user;

//   try {
//     // Verify account belongs to user
//     const account = await Account.findOne({ _id: accountId, userId });
//     if (!account) {
//       return next(new ApiError(404, "Account not found or access denied"));
//     }

//     const result = await TransactionService.getAccountBalance(
//       accountId,
//       parseInt(limit)
//     );

//     res
//       .status(200)
//       .json(new ApiRes(200, result, "Account balance retrieved successfully"));
//   } catch (error) {
//     console.error("Get balance error:", error);
//     return next(new ApiError(error.statusCode || 500, error.message));
//   }
// });

// // Get transaction history for an account
// export const getTransactionHistory = asyncHandler(async (req, res, next) => {
//   const { accountId } = req.params;
//   const {
//     type,
//     status,
//     dateFrom,
//     dateTo,
//     amountMin,
//     amountMax,
//     page = 1,
//     limit = 20,
//   } = req.query;
//   const userId = req.user;

//   try {
//     // Verify account belongs to user
//     const account = await Account.findOne({ _id: accountId, userId });
//     if (!account) {
//       return next(new ApiError(404, "Account not found or access denied"));
//     }

//     const filters = {
//       type,
//       status,
//       dateFrom,
//       dateTo,
//       amountMin,
//       amountMax,
//     };

//     // Remove undefined values from filters
//     Object.keys(filters).forEach((key) => {
//       if (filters[key] === undefined) {
//         delete filters[key];
//       }
//     });

//     const result = await TransactionService.getTransactionHistory(
//       accountId,
//       filters,
//       parseInt(page),
//       parseInt(limit)
//     );

//     res
//       .status(200)
//       .json(
//         new ApiRes(200, result, "Transaction history retrieved successfully")
//       );
//   } catch (error) {
//     console.error("Get transaction history error:", error);
//     return next(new ApiError(error.statusCode || 500, error.message));
//   }
// });

// // Process interest payment for savings/investment accounts
// export const processInterestPayment = asyncHandler(async (req, res, next) => {
//   const { accountId } = req.params;
//   const userId = req.user;

//   try {
//     // Verify account belongs to user
//     const account = await Account.findOne({ _id: accountId, userId });
//     if (!account) {
//       return next(new ApiError(404, "Account not found or access denied"));
//     }

//     const result = await TransactionService.processInterestPayment(accountId);

//     res
//       .status(200)
//       .json(new ApiRes(200, result, "Interest payment processed successfully"));
//   } catch (error) {
//     console.error("Process interest error:", error);
//     return next(new ApiError(error.statusCode || 500, error.message));
//   }
// });

// // Get transaction details by ID
// export const getTransactionDetails = asyncHandler(async (req, res, next) => {
//   const { transactionId } = req.params;
//   const userId = req.user;

//   try {
//     const transaction = await Transaction.findById(transactionId)
//       .populate("fromAccount", "accountNumber accountType userId")
//       .populate("toAccount", "accountNumber accountType userId");

//     if (!transaction) {
//       return next(new ApiError(404, "Transaction not found"));
//     }

//     // Check if user has access to this transaction
//     const hasAccess =
//       (transaction.fromAccount &&
//         transaction.fromAccount.userId.toString() === userId) ||
//       (transaction.toAccount &&
//         transaction.toAccount.userId.toString() === userId);

//     if (!hasAccess) {
//       return next(new ApiError(403, "Access denied to this transaction"));
//     }

//     res
//       .status(200)
//       .json(
//         new ApiRes(
//           200,
//           { transaction },
//           "Transaction details retrieved successfully"
//         )
//       );
//   } catch (error) {
//     console.error("Get transaction details error:", error);
//     return next(new ApiError(error.statusCode || 500, error.message));
//   }
// });

// // Get all transactions for user (across all accounts)
// export const getAllUserTransactions = asyncHandler(async (req, res, next) => {
//   const userId = req.user;
//   const {
//     type,
//     status,
//     dateFrom,
//     dateTo,
//     amountMin,
//     amountMax,
//     page = 1,
//     limit = 20,
//   } = req.query;

//   try {
//     // Get all user's accounts
//     const userAccounts = await Account.find({ userId }).select("_id");
//     const accountIds = userAccounts.map((acc) => acc._id);

//     if (accountIds.length === 0) {
//       return res.status(200).json(
//         new ApiRes(
//           200,
//           {
//             transactions: [],
//             pagination: {
//               currentPage: 1,
//               totalPages: 0,
//               totalTransactions: 0,
//               hasNextPage: false,
//               hasPrevPage: false,
//             },
//             summary: {
//               totalTransactions: 0,
//               totalDeposits: 0,
//               totalWithdrawals: 0,
//               totalTransfersOut: 0,
//               totalTransfersIn: 0,
//               totalInterest: 0,
//               totalFees: 0,
//               netFlow: 0,
//             },
//           },
//           "No accounts found for user"
//         )
//       );
//     }

//     // Build query for transactions involving user's accounts
//     const query = {
//       $or: [
//         { fromAccount: { $in: accountIds } },
//         { toAccount: { $in: accountIds } },
//       ],
//     };

//     // Apply filters
//     if (type) query.type = type;
//     if (status) query.status = status;
//     if (dateFrom || dateTo) {
//       query.createdAt = {};
//       if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
//       if (dateTo) query.createdAt.$lte = new Date(dateTo);
//     }
//     if (amountMin || amountMax) {
//       query.amount = {};
//       if (amountMin) query.amount.$gte = parseFloat(amountMin);
//       if (amountMax) query.amount.$lte = parseFloat(amountMax);
//     }

//     // Calculate pagination
//     const skip = (parseInt(page) - 1) * parseInt(limit);

//     // Get transactions and total count
//     const [transactions, totalCount] = await Promise.all([
//       Transaction.find(query)
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(parseInt(limit))
//         .populate("fromAccount", "accountNumber accountType")
//         .populate("toAccount", "accountNumber accountType"),
//       Transaction.countDocuments(query),
//     ]);

//     // Calculate summary (simplified version)
//     const summary = await Transaction.aggregate([
//       { $match: query },
//       {
//         $group: {
//           _id: null,
//           totalTransactions: { $sum: 1 },
//           totalAmount: { $sum: "$amount" },
//           avgAmount: { $avg: "$amount" },
//         },
//       },
//     ]);

//     const summaryData =
//       summary.length > 0
//         ? summary[0]
//         : {
//             totalTransactions: 0,
//             totalAmount: 0,
//             avgAmount: 0,
//           };

//     delete summaryData._id;

//     res.status(200).json(
//       new ApiRes(
//         200,
//         {
//           transactions,
//           pagination: {
//             currentPage: parseInt(page),
//             totalPages: Math.ceil(totalCount / parseInt(limit)),
//             totalTransactions: totalCount,
//             hasNextPage:
//               parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
//             hasPrevPage: parseInt(page) > 1,
//           },
//           summary: summaryData,
//         },
//         "User transactions retrieved successfully"
//       )
//     );
//   } catch (error) {
//     console.error("Get all user transactions error:", error);
//     return next(new ApiError(error.statusCode || 500, error.message));
//   }
// });

// // Cancel a pending transaction
// export const cancelTransaction = asyncHandler(async (req, res, next) => {
//   const { transactionId } = req.params;
//   const { reason = "Cancelled by user" } = req.body;
//   const userId = req.user;

//   try {
//     const transaction = await Transaction.findById(transactionId)
//       .populate("fromAccount", "userId")
//       .populate("toAccount", "userId");

//     if (!transaction) {
//       return next(new ApiError(404, "Transaction not found"));
//     }

//     // Check if user has access to cancel this transaction
//     const hasAccess =
//       (transaction.fromAccount &&
//         transaction.fromAccount.userId.toString() === userId) ||
//       (transaction.toAccount &&
//         transaction.toAccount.userId.toString() === userId);

//     if (!hasAccess) {
//       return next(
//         new ApiError(403, "Access denied to cancel this transaction")
//       );
//     }

//     if (transaction.status !== "pending") {
//       return next(
//         new ApiError(400, `Cannot cancel ${transaction.status} transaction`)
//       );
//     }

//     // Update transaction status
//     transaction.status = "cancelled";
//     transaction.metadata = {
//       ...transaction.metadata,
//       cancellationReason: reason,
//       cancelledBy: userId,
//       cancelledAt: new Date(),
//     };
//     await transaction.save();

//     res
//       .status(200)
//       .json(
//         new ApiRes(200, { transaction }, "Transaction cancelled successfully")
//       );
//   } catch (error) {
//     console.error("Cancel transaction error:", error);
//     return next(new ApiError(error.statusCode || 500, error.message));
//   }
// });

// // Admin function: Reverse a transaction
// export const reverseTransaction = asyncHandler(async (req, res, next) => {
//   const { transactionId } = req.params;
//   const { reason = "Administrative reversal" } = req.body;
//   const userId = req.user;

//   try {
//     // Check if user has admin privileges
//     const userProfile = await RoleUserService.getUserCompleteProfile(userId);
//     if (!userProfile.roles.includes(ROLE_TYPES.ADMIN)) {
//       return next(
//         new ApiError(403, "Only administrators can reverse transactions")
//       );
//     }

//     const result = await TransactionService.reverseTransaction(
//       transactionId,
//       reason
//     );

//     res
//       .status(200)
//       .json(new ApiRes(200, result, "Transaction reversed successfully"));
//   } catch (error) {
//     console.error("Reverse transaction error:", error);
//     return next(new ApiError(error.statusCode || 500, error.message));
//   }
// });

// // Get transaction statistics for user
// export const getTransactionStatistics = asyncHandler(async (req, res, next) => {
//   const userId = req.user;
//   const { period = "month", accountId } = req.query;

//   try {
//     // Get user's accounts
//     const accountQuery = { userId };
//     if (accountId) {
//       accountQuery._id = accountId;
//       // Verify account belongs to user
//       const account = await Account.findOne(accountQuery);
//       if (!account) {
//         return next(new ApiError(404, "Account not found or access denied"));
//       }
//     }

//     const userAccounts = await Account.find(accountQuery).select("_id");
//     const accountIds = userAccounts.map((acc) => acc._id);

//     if (accountIds.length === 0) {
//       return res
//         .status(200)
//         .json(
//           new ApiRes(200, { statistics: {} }, "No accounts found for user")
//         );
//     }

//     // Calculate date range based on period
//     const now = new Date();
//     let startDate;

//     switch (period) {
//       case "week":
//         startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
//         break;
//       case "month":
//         startDate = new Date(now.getFullYear(), now.getMonth(), 1);
//         break;
//       case "quarter":
//         startDate = new Date(
//           now.getFullYear(),
//           Math.floor(now.getMonth() / 3) * 3,
//           1
//         );
//         break;
//       case "year":
//         startDate = new Date(now.getFullYear(), 0, 1);
//         break;
//       default:
//         startDate = new Date(now.getFullYear(), now.getMonth(), 1);
//     }

//     // Aggregate transaction statistics
//     const statistics = await Transaction.aggregate([
//       {
//         $match: {
//           $or: [
//             { fromAccount: { $in: accountIds } },
//             { toAccount: { $in: accountIds } },
//           ],
//           createdAt: { $gte: startDate },
//           status: "completed",
//         },
//       },
//       {
//         $group: {
//           _id: "$type",
//           count: { $sum: 1 },
//           totalAmount: { $sum: "$amount" },
//           avgAmount: { $avg: "$amount" },
//         },
//       },
//     ]);

//     // Format statistics
//     const formattedStats = {};
//     statistics.forEach((stat) => {
//       formattedStats[stat._id] = {
//         count: stat.count,
//         totalAmount: parseFloat(stat.totalAmount.toFixed(2)),
//         avgAmount: parseFloat(stat.avgAmount.toFixed(2)),
//       };
//     });

//     // Get daily transaction counts for the period
//     const dailyStats = await Transaction.aggregate([
//       {
//         $match: {
//           $or: [
//             { fromAccount: { $in: accountIds } },
//             { toAccount: { $in: accountIds } },
//           ],
//           createdAt: { $gte: startDate },
//           status: "completed",
//         },
//       },
//       {
//         $group: {
//           _id: {
//             $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
//           },
//           count: { $sum: 1 },
//           totalAmount: { $sum: "$amount" },
//         },
//       },
//       { $sort: { _id: 1 } },
//     ]);

//     res.status(200).json(
//       new ApiRes(
//         200,
//         {
//           period,
//           startDate,
//           endDate: now,
//           statistics: formattedStats,
//           dailyBreakdown: dailyStats,
//           totalAccounts: accountIds.length,
//         },
//         "Transaction statistics retrieved successfully"
//       )
//     );
//   } catch (error) {
//     console.error("Get transaction statistics error:", error);
//     return next(new ApiError(error.statusCode || 500, error.message));
//   }
// });
