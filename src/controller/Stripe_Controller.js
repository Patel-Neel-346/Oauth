// src/controller/Stripe_Controller.js
import Stripe from "stripe";
import Product from "../models/Product.js";
import { asyncHandler } from "../helpers/asyncHandler.js";
import { ConfigENV } from "../config/index.js";
import PaymentTransactionService from "../services/paymentTransactionService.js";
import Account from "../models/Account.js";
import { ApiError } from "../helpers/ApiError.js";

const stripe = new Stripe(ConfigENV.STRIPE_SECRET_KEY);

// Get all products
export const getAllProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ isActive: true }).select("-purchases");

  res.status(200).json({
    success: true,
    products,
  });
});

// Create payment intent
export const createPaymentIntent = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, customerEmail, accountNumber } = req.body;
  const userId = req.user; // From authentication middleware

  // Validate input
  if (!productId || !customerEmail) {
    return res.status(400).json({
      success: false,
      message: "Product ID and customer email are required",
    });
  }

  // Validate user's account if accountNumber provided
  if (accountNumber) {
    const userAccount = await Account.findOne({
      accountNumber,
      userId,
      status: "active",
    });

    if (!userAccount) {
      return res.status(404).json({
        success: false,
        message: "Account not found or inactive",
      });
    }
  }

  // Sample products (replace with your actual product logic)
  const sampleProducts = {
    1: {
      name: "Premium Wireless Headphones",
      price: 199.99,
      currency: "usd",
      stock: 15,
    },
    2: {
      name: "Smart Fitness Watch",
      price: 299.99,
      currency: "usd",
      stock: 8,
    },
    3: {
      name: "Portable Bluetooth Speaker",
      price: 79.99,
      currency: "usd",
      stock: 25,
    },
  };

  const product = sampleProducts[productId];

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  // Check stock
  if (product.stock < quantity) {
    return res.status(400).json({
      success: false,
      message: "Insufficient stock",
    });
  }

  try {
    const amount = Math.round(product.price * quantity * 100); // Convert to cents

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: product.currency,
      metadata: {
        productId: productId,
        productName: product.name,
        quantity: quantity.toString(),
        customerEmail,
        userId: userId.toString(),
        accountNumber: accountNumber || "",
      },
      receipt_email: customerEmail,
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Stripe error:", error);
    res.status(500).json({
      success: false,
      message: "Payment processing error",
      error: error.message,
    });
  }
});

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
// Confirm payment and create bank transaction
export const confirmPayment = asyncHandler(async (req, res) => {
  const { paymentIntentId } = req.body;
  const userId = req.user;

  if (!paymentIntentId) {
    return res.status(400).json({
      success: false,
      message: "Payment Intent ID is required",
    });
  }

  try {
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      const { productId, quantity, customerEmail, accountNumber } =
        paymentIntent.metadata;

      // Create payment transaction in your banking system
      try {
        const paymentTransactionResult =
          await PaymentTransactionService.processPaymentTransaction({
            paymentIntentId: paymentIntent.id,
            customerEmail,
            amount: paymentIntent.amount / 100, // Convert back from cents
            currency: paymentIntent.currency,
            productId,
            productName: paymentIntent.metadata.productName,
            quantity,
            userId,
            paymentMethod: "stripe",
            description: `Purchase: ${paymentIntent.metadata.productName}`,
          });

        console.log(
          `Payment transaction created: ${paymentTransactionResult.transaction._id}`
        );

        res.status(200).json({
          success: true,
          message: "Payment confirmed and transaction recorded successfully",
          purchase: {
            productName: paymentIntent.metadata.productName,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
          },
          bankTransaction: {
            transactionId: paymentTransactionResult.transaction._id,
            reference: paymentTransactionResult.transaction.reference,
            customerAccount:
              paymentTransactionResult.customerAccount.accountNumber,
          },
        });
      } catch (bankError) {
        console.error("Bank transaction error:", bankError);

        // Payment succeeded in Stripe but bank transaction failed
        // You might want to handle this scenario differently
        res.status(200).json({
          success: true,
          message: "Payment confirmed but bank transaction recording failed",
          warning: "Please contact support for transaction reconciliation",
          purchase: {
            productName: paymentIntent.metadata.productName,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
          },
          error: bankError.message,
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: "Payment not completed",
      });
    }
  } catch (error) {
    console.error("Payment confirmation error:", error);
    res.status(500).json({
      success: false,
      message: "Error confirming payment",
      error: error.message,
    });
  }
});

// Enhanced webhook handler
export const handleWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      console.log("Payment succeeded:", paymentIntent.id);

      try {
        // Create bank transaction from webhook
        const { userId, productId, productName, quantity, customerEmail } =
          paymentIntent.metadata;

        if (userId) {
          await PaymentTransactionService.processPaymentTransaction({
            paymentIntentId: paymentIntent.id,
            customerEmail,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            productId,
            productName,
            quantity,
            userId,
            paymentMethod: "stripe",
            description: `Webhook: Purchase ${productName}`,
          });
        }
      } catch (error) {
        console.error("Webhook payment transaction error:", error);
      }
      break;

    case "payment_intent.payment_failed":
      const failedPayment = event.data.object;
      console.log("Payment failed:", failedPayment.id);
      // Handle failed payments if needed
      break;

    case "charge.dispute.created":
      const dispute = event.data.object;
      console.log("Dispute created:", dispute.id);
      // Handle disputes if needed
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Get payment history for authenticated user
export const getPaymentHistory = asyncHandler(async (req, res) => {
  const userId = req.user;
  const {
    page = 1,
    limit = 10,
    type,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
  } = req.query;

  try {
    const filters = {};
    if (type) filters.type = type;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (amountMin) filters.amountMin = amountMin;
    if (amountMax) filters.amountMax = amountMax;

    const result = await PaymentTransactionService.getPaymentHistory(
      userId,
      filters,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Payment history error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving payment history",
      error: error.message,
    });
  }
});

// Get payment statistics for authenticated user
export const getPaymentStatistics = asyncHandler(async (req, res) => {
  const userId = req.user;
  const { period = "month" } = req.query;

  try {
    const result = await PaymentTransactionService.getPaymentStatistics(
      userId,
      period
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Payment statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving payment statistics",
      error: error.message,
    });
  }
});

// Process refund
export const processRefund = asyncHandler(async (req, res) => {
  const { paymentIntentId, amount, reason } = req.body;
  const userId = req.user;

  if (!paymentIntentId) {
    return res.status(400).json({
      success: false,
      message: "Payment Intent ID is required",
    });
  }

  try {
    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Convert to cents if partial refund
      reason: reason || "requested_by_customer",
    });

    // Create refund transaction in banking system
    try {
      const refundTransactionResult =
        await PaymentTransactionService.processRefundTransaction({
          originalPaymentIntentId: paymentIntentId,
          refundId: refund.id,
          amount: refund.amount / 100, // Convert back from cents
          reason: reason || "Customer requested refund",
          userId,
        });

      res.status(200).json({
        success: true,
        message: "Refund processed successfully",
        refund: {
          id: refund.id,
          amount: refund.amount / 100,
          status: refund.status,
        },
        bankTransaction: {
          transactionId: refundTransactionResult.refundTransaction._id,
          reference: refundTransactionResult.refundTransaction.reference,
        },
      });
    } catch (bankError) {
      console.error("Bank refund transaction error:", bankError);

      res.status(200).json({
        success: true,
        message:
          "Refund processed in Stripe but bank transaction recording failed",
        warning: "Please contact support for transaction reconciliation",
        refund: {
          id: refund.id,
          amount: refund.amount / 100,
          status: refund.status,
        },
        error: bankError.message,
      });
    }
  } catch (error) {
    console.error("Refund processing error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing refund",
      error: error.message,
    });
  }
});

// Get purchase history for a product
export const getProductPurchases = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const product = await Product.findById(productId).select("name purchases");

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  res.status(200).json({
    success: true,
    productName: product.name,
    purchases: product.purchases,
  });
});
