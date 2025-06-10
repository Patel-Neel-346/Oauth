// import { ApiError } from "../helpers/ApiError.js";
// import { ApiRes } from "../helpers/ApiRespones.js";
// import { asyncHandler } from "../helpers/asyncHandler.js";
// import Account from "../models/Account.js";
// import User from "../models/User.js";
// import Transaction from "../models/Transaction.js";
// import StripeService from "../services/StripeService.js";

// const stripeService = new StripeService();

// export const createPaymentIntent = asyncHandler(async (req, res, next) => {
//   const { accountNumber, amount, currency, description, paymentMethodId } =
//     req.body;
//   const userId = req.user;

//   try {
//     if (!accountNumber || !amount) {
//       return next(new ApiError(400, "Account number and amount are required"));
//     }

//     const account = await Account.findOne({ accountNumber, userId });
//     if (!account) {
//       return next(new ApiError(404, "Account not found"));
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       return next(new ApiError(404, "User not found"));
//     }

//     const paymentData = {
//       amount: parseFloat(amount),
//       currency: currency || "usd",
//       accountId: account._id.toString(),
//       userId: userId,
//       description: description || `Payment to account ${accountNumber}`,
//       paymentMethodId,
//       customerData: {
//         email: user.email,
//         name: user.name || `${user.firstName} ${user.lastName}`,
//         phone: user.phone,
//       },
//       metadata: {
//         account_number: accountNumber,
//         user_email: user.email,
//       },
//     };

//     const result = await stripeService.createPaymentIntent(paymentData);

//     return res
//       .status(200)
//       .json(new ApiRes(200, result, "Payment intent created successfully"));
//   } catch (error) {
//     return next(
//       new ApiError(500, `Payment intent creation failed: ${error.message}`)
//     );
//   }
// });

// export const createPaymentMethod = asyncHandler(async (req, res, next) => {
//   const { number, exp_month, exp_year, cvc, name, email, phone } = req.body;
//   const userId = req.user;

//   try {
//     if (!number || !exp_month || !exp_year || !cvc) {
//       return next(new ApiError(400, "Card details are required"));
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       return next(new ApiError(404, "User not found"));
//     }

//     const customerData = {
//       email: email || user.email,
//       name: name || user.name || `${user.firstName} ${user.lastName}`,
//       phone: phone || user.phone,
//     };

//     const customer = await stripeService.createOrGetCustomer(
//       customerData,
//       userId
//     );

//     const cardData = {
//       number,
//       exp_month: parseInt(exp_month),
//       exp_year: parseInt(exp_year),
//       cvc,
//       name: customerData.name,
//       email: customerData.email,
//       phone: customerData.phone,
//     };

//     const result = await stripeService.createPaymentMethod(
//       cardData,
//       customer.id
//     );

//     return res
//       .status(200)
//       .json(new ApiRes(200, result, "Payment method created successfully"));
//   } catch (error) {
//     return next(
//       new ApiError(500, `Payment method creation failed: ${error.message}`)
//     );
//   }
// });

// export const getUserPaymentMethods = asyncHandler(async (req, res, next) => {
//   const userId = req.user;

//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       return next(new ApiError(404, "User not found"));
//     }

//     const existingCustomers = await stripeService.stripe.customers.list({
//       email: user.email,
//       limit: 1,
//     });

//     if (existingCustomers.data.length === 0) {
//       return res
//         .status(200)
//         .json(
//           new ApiRes(200, { paymentMethods: [] }, "No payment methods found")
//         );
//     }

//     const customer = existingCustomers.data[0];
//     const result = await stripeService.getUserPaymentMethods(customer.id);

//     return res
//       .status(200)
//       .json(new ApiRes(200, result, "Payment methods retrieved successfully"));
//   } catch (error) {
//     return next(
//       new ApiError(500, `Failed to retrieve payment methods: ${error.message}`)
//     );
//   }
// });

// export const deletePaymentMethod = asyncHandler(async (req, res, next) => {
//   const { paymentMethodId } = req.params;
//   const userId = req.user;

//   try {
//     if (!paymentMethodId) {
//       return next(new ApiError(400, "Payment method ID is required"));
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       return next(new ApiError(404, "User not found"));
//     }

//     const result = await stripeService.deletePaymentMethod(paymentMethodId);

//     return res
//       .status(200)
//       .json(new ApiRes(200, result, "Payment method deleted successfully"));
//   } catch (error) {
//     return next(
//       new ApiError(500, `Payment method deletion failed: ${error.message}`)
//     );
//   }
// });

// export const processPayment = asyncHandler(async (req, res, next) => {
//   const { accountNumber, amount, currency, description, paymentMethodId } =
//     req.body;
//   const userId = req.user;

//   try {
//     if (!accountNumber || !amount || !paymentMethodId) {
//       return next(
//         new ApiError(
//           400,
//           "Account number, amount, and payment method are required"
//         )
//       );
//     }

//     const account = await Account.findOne({ accountNumber, userId });
//     if (!account) {
//       return next(new ApiError(404, "Account not found"));
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       return next(new ApiError(404, "User not found"));
//     }

//     const paymentData = {
//       amount: parseFloat(amount),
//       currency: currency || "usd",
//       accountId: account._id.toString(),
//       userId: userId,
//       description: description || `Payment to account ${accountNumber}`,
//       paymentMethodId,
//       customerData: {
//         email: user.email,
//         name: user.name || `${user.firstName} ${user.lastName}`,
//         phone: user.phone,
//       },
//       metadata: {
//         account_number: accountNumber,
//         user_email: user.email,
//       },
//     };

//     const result = await stripeService.processPayment(paymentData);

//     return res
//       .status(200)
//       .json(
//         new ApiRes(
//           200,
//           result,
//           result.success ? "Payment processed successfully!" : "Payment failed"
//         )
//       );
//   } catch (error) {
//     return next(
//       new ApiError(500, `Payment processing failed: ${error.message}`)
//     );
//   }
// });

// export const handleStripeWebhook = asyncHandler(async (req, res, next) => {
//   const signature = req.headers["stripe-signature"];
//   const payload = req.body;

//   try {
//     if (!signature) {
//       return next(new ApiError(400, "Missing Stripe signature"));
//     }

//     const result = await stripeService.handleWebhook(payload, signature);

//     return res
//       .status(200)
//       .json(new ApiRes(200, result, "Webhook processed successfully"));
//   } catch (error) {
//     return next(
//       new ApiError(400, `Webhook processing failed: ${error.message}`)
//     );
//   }
// });

// export const refundPayment = asyncHandler(async (req, res, next) => {
//   const { paymentIntentId, amount, reason } = req.body;
//   const userId = req.user;

//   try {
//     if (!paymentIntentId) {
//       return next(new ApiError(400, "Payment intent ID is required"));
//     }

//     const transaction = await Transaction.findOne({
//       reference: `STRIPE_${paymentIntentId}`,
//       "metadata.user_id": userId,
//     }).populate("toAccount");

//     if (!transaction) {
//       return next(new ApiError(404, "Payment not found or unauthorized"));
//     }

//     const result = await stripeService.refundPayment(
//       paymentIntentId,
//       amount ? parseFloat(amount) : null,
//       reason
//     );

//     return res
//       .status(200)
//       .json(new ApiRes(200, result, "Refund processed successfully"));
//   } catch (error) {
//     return next(
//       new ApiError(500, `Refund processing failed: ${error.message}`)
//     );
//   }
// });

// export const getPaymentDetails = asyncHandler(async (req, res, next) => {
//   const { paymentIntentId } = req.params;
//   const userId = req.user;

//   try {
//     if (!paymentIntentId) {
//       return next(new ApiError(400, "Payment intent ID is required"));
//     }

//     const transaction = await Transaction.findOne({
//       reference: `STRIPE_${paymentIntentId}`,
//       "metadata.user_id": userId,
//     });

//     if (!transaction) {
//       return next(new ApiError(404, "Payment not found or unauthorized"));
//     }

//     const result = await stripeService.getPaymentDetails(paymentIntentId);

//     return res
//       .status(200)
//       .json(new ApiRes(200, result, "Payment details retrieved successfully"));
//   } catch (error) {
//     return next(
//       new ApiError(500, `Failed to retrieve payment details: ${error.message}`)
//     );
//   }
// });

// export const getStripePaymentHistory = asyncHandler(async (req, res, next) => {
//   const userId = req.user;
//   const { page = 1, limit = 10, status, accountNumber } = req.query;

//   try {
//     const query = {
//       type: "stripe_payment",
//       "metadata.user_id": userId,
//     };

//     if (status) {
//       query.status = status;
//     }

//     if (accountNumber) {
//       const account = await Account.findOne({ accountNumber, userId });
//       if (!account) {
//         return next(new ApiError(404, "Account not found"));
//       }
//       query.toAccount = account._id;
//     }

//     const skip = (page - 1) * limit;

//     const [transactions, totalCount] = await Promise.all([
//       Transaction.find(query)
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(parseInt(limit))
//         .populate("toAccount", "accountNumber accountType")
//         .select(
//           "amount type status description reference createdAt processAt metadata"
//         ),
//       Transaction.countDocuments(query),
//     ]);

//     const result = {
//       transactions,
//       pagination: {
//         currentPage: parseInt(page),
//         totalPages: Math.ceil(totalCount / limit),
//         totalTransactions: totalCount,
//         hasNextPage: page < Math.ceil(totalCount / limit),
//         hasPrevPage: page > 1,
//       },
//     };

//     return res
//       .status(200)
//       .json(
//         new ApiRes(200, result, "Stripe payment history retrieved successfully")
//       );
//   } catch (error) {
//     return next(
//       new ApiError(500, `Failed to retrieve payment history: ${error.message}`)
//     );
//   }
// });
