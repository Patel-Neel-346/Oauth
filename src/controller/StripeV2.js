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

// Add these methods to your StripeV2.js controller

/**
 * Create a new payment method
 */
export const createPaymentMethod = asyncHandler(async (req, res, next) => {
  const { cardNumber, expMonth, expYear, cvc, name, email, phone } = req.body;
  const userId = req.user;

  try {
    if (!cardNumber || !expMonth || !expYear || !cvc) {
      return next(new ApiError(400, "Card details are required"));
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return next(new ApiError(404, "User not found"));
    }

    // Create or get customer
    const customerData = {
      email: email || user.email,
      name: name || user.name || `${user.firstName} ${user.lastName}`,
      phone: phone || user.phone,
    };

    const customer = await stripeService.createOrGetCustomer(
      customerData,
      userId
    );

    // Create payment method
    const cardData = {
      number: cardNumber,
      exp_month: parseInt(expMonth),
      exp_year: parseInt(expYear),
      cvc,
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
    };

    const result = await stripeService.createPaymentMethod(
      cardData,
      customer.id
    );

    return res
      .status(200)
      .json(new ApiRes(200, result, "Payment method created successfully"));
  } catch (error) {
    console.log("Create Payment Method Error:", error);
    return next(
      new ApiError(500, `Payment method creation failed: ${error.message}`)
    );
  }
});

/**
 * Get user's saved payment methods
 */
export const getUserPaymentMethods = asyncHandler(async (req, res, next) => {
  const userId = req.user;

  try {
    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return next(new ApiError(404, "User not found"));
    }

    // Find existing customer
    const existingCustomers = await stripeService.stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (existingCustomers.data.length === 0) {
      return res
        .status(200)
        .json(
          new ApiRes(200, { paymentMethods: [] }, "No payment methods found")
        );
    }

    const customer = existingCustomers.data[0];
    const result = await stripeService.getCustomerPaymentMethods(customer.id);

    return res
      .status(200)
      .json(new ApiRes(200, result, "Payment methods retrieved successfully"));
  } catch (error) {
    console.log("Get Payment Methods Error:", error);
    return next(
      new ApiError(500, `Failed to retrieve payment methods: ${error.message}`)
    );
  }
});

/**
 * Delete a payment method
 */
export const deletePaymentMethod = asyncHandler(async (req, res, next) => {
  const { paymentMethodId } = req.params;
  const userId = req.user;

  try {
    if (!paymentMethodId) {
      return next(new ApiError(400, "Payment method ID is required"));
    }

    // Verify the payment method belongs to this user (security check)
    const user = await User.findById(userId);
    if (!user) {
      return next(new ApiError(404, "User not found"));
    }

    const result = await stripeService.deletePaymentMethod(paymentMethodId);

    return res
      .status(200)
      .json(new ApiRes(200, result, "Payment method deleted successfully"));
  } catch (error) {
    console.log("Delete Payment Method Error:", error);
    return next(
      new ApiError(500, `Payment method deletion failed: ${error.message}`)
    );
  }
});

/**
 * Update payment method billing details
 */
export const updatePaymentMethod = asyncHandler(async (req, res, next) => {
  const { paymentMethodId } = req.params;
  const { name, email, phone, address } = req.body;
  const userId = req.user;

  try {
    if (!paymentMethodId) {
      return next(new ApiError(400, "Payment method ID is required"));
    }

    const billingDetails = {};
    if (name) billingDetails.name = name;
    if (email) billingDetails.email = email;
    if (phone) billingDetails.phone = phone;
    if (address) billingDetails.address = address;

    const result = await stripeService.updatePaymentMethod(
      paymentMethodId,
      billingDetails
    );

    return res
      .status(200)
      .json(new ApiRes(200, result, "Payment method updated successfully"));
  } catch (error) {
    console.log("Update Payment Method Error:", error);
    return next(
      new ApiError(500, `Payment method update failed: ${error.message}`)
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

export const createPaymentMethodFromToken = asyncHandler(
  async (req, res, next) => {
    const { token, billing_details } = req.body;
    const userId = req.user;

    try {
      if (!token) {
        return next(new ApiError(400, "Token is required"));
      }

      // Get user details for Stripe customer
      const user = await User.findById(userId);
      if (!user) {
        return next(new ApiError(404, "User not found"));
      }

      // Create or get customer
      const customer = await stripeService.createOrGetCustomer(
        {
          email: user.email,
          name: user.name || `${user.firstName} ${user.lastName}`,
          phone: user.phone,
        },
        userId
      );

      const result = await stripeService.createPaymentMethodFromTestToken(
        { token, billing_details },
        customer.id
      );

      return res
        .status(200)
        .json(new ApiRes(200, result, "Payment method created successfully"));
    } catch (error) {
      console.log("Create Payment Method Error:", error);
      return next(
        new ApiError(500, `Payment method creation failed: ${error.message}`)
      );
    }
  }
);

/**
 * Create a payment method using card details (Sources API)
 */
export const createPaymentMethodFromCard = asyncHandler(
  async (req, res, next) => {
    const { number, exp_month, exp_year, cvc, name, email } = req.body;
    const userId = req.user;

    try {
      if (!number || !exp_month || !exp_year || !cvc) {
        return next(new ApiError(400, "Card details are required"));
      }

      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        return next(new ApiError(404, "User not found"));
      }

      // Create or get customer
      const customer = await stripeService.createOrGetCustomer(
        {
          email: user.email,
          name: user.name || `${user.firstName} ${user.lastName}`,
          phone: user.phone,
        },
        userId
      );

      const cardData = {
        number,
        exp_month: parseInt(exp_month),
        exp_year: parseInt(exp_year),
        cvc,
        name: name || user.name || `${user.firstName} ${user.lastName}`,
        email: email || user.email,
      };

      const result = await stripeService.createPaymentMethodFromSource(
        cardData,
        customer.id
      );

      return res
        .status(200)
        .json(new ApiRes(200, result, "Payment method created successfully"));
    } catch (error) {
      console.log("Create Payment Method Error:", error);
      return next(
        new ApiError(500, `Payment method creation failed: ${error.message}`)
      );
    }
  }
);

/**
 * Create a payment method using raw card data (requires special Stripe configuration)
 */
export const createPaymentMethodRawCard = asyncHandler(
  async (req, res, next) => {
    const { number, exp_month, exp_year, cvc, name, email, phone } = req.body;
    const userId = req.user;

    try {
      if (!number || !exp_month || !exp_year || !cvc) {
        return next(new ApiError(400, "Card details are required"));
      }

      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        return next(new ApiError(404, "User not found"));
      }

      // Create or get customer
      const customer = await stripeService.createOrGetCustomer(
        {
          email: user.email,
          name: user.name || `${user.firstName} ${user.lastName}`,
          phone: user.phone,
        },
        userId
      );

      const cardData = {
        number,
        exp_month: parseInt(exp_month),
        exp_year: parseInt(exp_year),
        cvc,
        name: name || user.name || `${user.firstName} ${user.lastName}`,
        email: email || user.email,
        phone: phone || user.phone,
      };

      const result = await stripeService.createPaymentMethodRawCard(
        cardData,
        customer.id
      );

      return res
        .status(200)
        .json(new ApiRes(200, result, "Payment method created successfully"));
    } catch (error) {
      console.log("Create Payment Method Error:", error);
      return next(
        new ApiError(500, `Payment method creation failed: ${error.message}`)
      );
    }
  }
);

/**
 * Get available test tokens
 */
export const getTestTokens = asyncHandler(async (req, res, next) => {
  try {
    const tokens = stripeService.getTestTokens();
    return res
      .status(200)
      .json(new ApiRes(200, tokens, "Test tokens retrieved successfully"));
  } catch (error) {
    return next(
      new ApiError(500, `Failed to get test tokens: ${error.message}`)
    );
  }
});

/**
 * Get user's payment methods
 */

/**
 * Delete a payment method
 */

/**
 * Update payment method billing details
 */

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
