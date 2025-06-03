import { ApiError } from "../helpers/ApiError.js";
import { ApiRes } from "../helpers/ApiRespones.js";
import { asyncHandler } from "../helpers/asyncHandler.js";
import Account from "../models/Account.js";
import User from "../models/User.js";
import StripeService from "../services/StripeService.js";

const stripeService = new StripeService();

/**
 * Create a payment intent
 */
export const createPaymentIntent = asyncHandler(async (req, res, next) => {
  const { accountNumber, amount, currency, description, paymentMethodId } =
    req.body;
  const userId = req.user;

  console.log("AccountNumber:", accountNumber);
  console.log("amount:", amount);
  console.log("currency:", currency);
  console.log("desc:", description);
  console.log("paymentMethodID", paymentMethodId);
  try {
    if (!accountNumber || !amount) {
      return next(new ApiError(400, "Account number and amount are required"));
    }

    // Find the account
    const account = await Account.findOne({ accountNumber, userId });
    if (!account) {
      return next(new ApiError(404, "Account not found"));
    }

    // Get user details for Stripe customer
    const user = await User.findById(userId);
    if (!user) {
      return next(new ApiError(404, "User not found"));
    }

    const paymentData = {
      amount: parseFloat(amount),
      currency: currency || "usd",
      accountId: account._id.toString(),
      userId: userId,
      description: description || `Payment to account ${accountNumber}`,
      paymentMethodId,
      customerData: {
        email: user.email,
        name: user.name || `${user.firstName} ${user.lastName}`,
        phone: user.phone,
      },
      metadata: {
        account_number: accountNumber,
        user_email: user.email,
      },
    };

    const result = await stripeService.createPaymentIntent(paymentData);

    return res
      .status(200)
      .json(new ApiRes(200, result, "Payment intent created successfully"));
  } catch (error) {
    console.log("Create Payment Intent Error:", error);
    return next(
      new ApiError(500, `Payment intent creation failed: ${error.message}`)
    );
  }
});

/**
 * Process a direct payment
 */
export const processPayment = asyncHandler(async (req, res, next) => {
  const { accountNumber, amount, currency, description, paymentMethodId } =
    req.body;
  const userId = req.user;

  try {
    if (!accountNumber || !amount || !paymentMethodId) {
      return next(
        new ApiError(
          400,
          "Account number, amount, and payment method are required"
        )
      );
    }

    // Find the account
    const account = await Account.findOne({ accountNumber, userId });
    if (!account) {
      return next(new ApiError(404, "Account not found"));
    }

    // Get user details for Stripe customer
    const user = await User.findById(userId);
    if (!user) {
      return next(new ApiError(404, "User not found"));
    }

    const paymentData = {
      amount: parseFloat(amount),
      currency: currency || "usd",
      accountId: account._id.toString(),
      userId: userId,
      description: description || `Payment to account ${accountNumber}`,
      paymentMethodId,
      customerData: {
        email: user.email,
        name: user.name || `${user.firstName} ${user.lastName}`,
        phone: user.phone,
      },
      metadata: {
        account_number: accountNumber,
        user_email: user.email,
      },
    };

    const result = await stripeService.processPayment(paymentData);

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          result,
          result.success ? "Payment processed successfully!" : "Payment failed"
        )
      );
  } catch (error) {
    console.log("Process Payment Error:", error);
    return next(
      new ApiError(500, `Payment processing failed: ${error.message}`)
    );
  }
});

/**
 * Handle Stripe webhooks
 */
export const handleStripeWebhook = asyncHandler(async (req, res, next) => {
  const signature = req.headers["stripe-signature"];
  const payload = req.body;

  try {
    if (!signature) {
      return next(new ApiError(400, "Missing Stripe signature"));
    }

    const result = await stripeService.handleWebhook(payload, signature);

    return res
      .status(200)
      .json(new ApiRes(200, result, "Webhook processed successfully"));
  } catch (error) {
    console.log("Webhook Error:", error);
    return next(
      new ApiError(400, `Webhook processing failed: ${error.message}`)
    );
  }
});

/**
 * Refund a payment
 */
export const refundPayment = asyncHandler(async (req, res, next) => {
  const { paymentIntentId, amount, reason } = req.body;
  const userId = req.user;

  try {
    if (!paymentIntentId) {
      return next(new ApiError(400, "Payment intent ID is required"));
    }

    // Verify the payment belongs to this user (security check)
    const transaction = await Transaction.findOne({
      reference: `STRIPE_${paymentIntentId}`,
      "metadata.user_id": userId,
    }).populate("toAccount");

    if (!transaction) {
      return next(new ApiError(404, "Payment not found or unauthorized"));
    }

    const result = await stripeService.refundPayment(
      paymentIntentId,
      amount ? parseFloat(amount) : null,
      reason
    );

    return res
      .status(200)
      .json(new ApiRes(200, result, "Refund processed successfully"));
  } catch (error) {
    console.log("Refund Error:", error);
    return next(
      new ApiError(500, `Refund processing failed: ${error.message}`)
    );
  }
});

/**
 * Get payment details
 */
export const getPaymentDetails = asyncHandler(async (req, res, next) => {
  const { paymentIntentId } = req.params;
  const userId = req.user;

  try {
    if (!paymentIntentId) {
      return next(new ApiError(400, "Payment intent ID is required"));
    }

    // Verify the payment belongs to this user (security check)
    const transaction = await Transaction.findOne({
      reference: `STRIPE_${paymentIntentId}`,
      "metadata.user_id": userId,
    });

    if (!transaction) {
      return next(new ApiError(404, "Payment not found or unauthorized"));
    }

    const result = await stripeService.getPaymentDetails(paymentIntentId);

    return res
      .status(200)
      .json(new ApiRes(200, result, "Payment details retrieved successfully"));
  } catch (error) {
    console.log("Get Payment Details Error:", error);
    return next(
      new ApiError(500, `Failed to retrieve payment details: ${error.message}`)
    );
  }
});

/**
 * Get user's Stripe payment history
 */
export const getStripePaymentHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user;
  const { page = 1, limit = 10, status, accountNumber } = req.query;

  try {
    // Build query
    const query = {
      type: "stripe_payment",
      "metadata.user_id": userId,
    };

    if (status) {
      query.status = status;
    }

    if (accountNumber) {
      const account = await Account.findOne({ accountNumber, userId });
      if (!account) {
        return next(new ApiError(404, "Account not found"));
      }
      query.toAccount = account._id;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    const [transactions, totalCount] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("toAccount", "accountNumber accountType")
        .select(
          "amount type status description reference createdAt processAt metadata"
        ),
      Transaction.countDocuments(query),
    ]);

    const result = {
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalTransactions: totalCount,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      },
    };

    return res
      .status(200)
      .json(
        new ApiRes(200, result, "Stripe payment history retrieved successfully")
      );
  } catch (error) {
    console.log("Get Stripe Payment History Error:", error);
    return next(
      new ApiError(500, `Failed to retrieve payment history: ${error.message}`)
    );
  }
});

export default {
  createPaymentIntent,
  processPayment,
  handleStripeWebhook,
  refundPayment,
  getPaymentDetails,
  getStripePaymentHistory,
};
