import Stripe from "stripe";
import Product from "../models/Product.js";
import { asyncHandler } from "../helpers/asyncHandler.js";
import { ConfigENV } from "../config/index.js";

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
  const { productId, quantity = 1, customerEmail } = req.body;

  // Validate input
  if (!productId || !customerEmail) {
    return res.status(400).json({
      success: false,
      message: "Product ID and customer email are required",
    });
  }

  // For demo purposes, since you're using sample data in frontend,
  // we'll use hardcoded product data instead of database lookup
  let product;

  try {
    // Use sample data for demo (since frontend uses simple IDs like "1", "2", "3")
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

    product = sampleProducts[productId];

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

// Confirm payment and update product
export const confirmPayment = asyncHandler(async (req, res) => {
  const { paymentIntentId } = req.body;

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
      const { productId, quantity, customerEmail } = paymentIntent.metadata;

      // For demo purposes, we'll skip database updates since we're using sample data
      // In a real application, you'd update the database here if using real MongoDB ObjectIds

      console.log(
        `Payment succeeded for product ${productId}, quantity: ${quantity}`
      );

      res.status(200).json({
        success: true,
        message: "Payment confirmed successfully",
        purchase: {
          productName: paymentIntent.metadata.productName,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
        },
      });
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

// Webhook handler for Stripe events
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

      // Update product purchase status
      const { productId, quantity, customerEmail } = paymentIntent.metadata;
      const product = await Product.findById(productId);

      if (product) {
        const purchaseIndex = product.purchases.findIndex(
          (p) => p.paymentIntentId === paymentIntent.id
        );
        if (purchaseIndex > -1) {
          product.purchases[purchaseIndex].status = "succeeded";
          await product.save();
        }
      }
      break;

    case "payment_intent.payment_failed":
      const failedPayment = event.data.object;
      console.log("Payment failed:", failedPayment.id);

      // Update product purchase status to failed
      const failedProductId = failedPayment.metadata.productId;
      const failedProduct = await Product.findById(failedProductId);

      if (failedProduct) {
        const failedPurchaseIndex = failedProduct.purchases.findIndex(
          (p) => p.paymentIntentId === failedPayment.id
        );
        if (failedPurchaseIndex > -1) {
          failedProduct.purchases[failedPurchaseIndex].status = "failed";
          await failedProduct.save();
        }
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
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
