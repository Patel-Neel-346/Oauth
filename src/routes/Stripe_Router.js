import express from "express";
import {
  createPaymentIntent,
  processPayment,
  handleStripeWebhook,
  refundPayment,
  getPaymentDetails,
  getStripePaymentHistory,
  // New payment method imports
  createPaymentMethodFromToken,
  createPaymentMethodFromCard,
  createPaymentMethodRawCard,
  getTestTokens,
  getUserPaymentMethods,
  deletePaymentMethod,
  updatePaymentMethod,
} from "../controller/StripeV2.js";
import { Authenticated } from "../middleware/authMiddleware.js";

const StripeRouter = express.Router();

// Public webhook endpoint (no auth required)
StripeRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Public test tokens endpoint (for development)
StripeRouter.get("/test-tokens", getTestTokens);

// Protected routes (require authentication)
StripeRouter.use(Authenticated);

// Payment routes
StripeRouter.post("/create-payment-intent", createPaymentIntent);
StripeRouter.post("/process-payment", processPayment);
StripeRouter.post("/refund", refundPayment);

// Payment information routes
StripeRouter.get("/payment/:paymentIntentId", getPaymentDetails);
StripeRouter.get("/history", getStripePaymentHistory);

// Payment Methods routes - Multiple approaches
StripeRouter.post("/payment-methods/from-token", createPaymentMethodFromToken);
StripeRouter.post("/payment-methods/from-card", createPaymentMethodFromCard);
StripeRouter.post("/payment-methods/raw-card", createPaymentMethodRawCard);
StripeRouter.get("/payment-methods", getUserPaymentMethods);
StripeRouter.delete("/payment-methods/:paymentMethodId", deletePaymentMethod);
StripeRouter.put("/payment-methods/:paymentMethodId", updatePaymentMethod);

export default StripeRouter;
