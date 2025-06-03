import express from "express";
import {
  createPaymentIntent,
  processPayment,
  handleStripeWebhook,
  refundPayment,
  getPaymentDetails,
  getStripePaymentHistory,
  // Add these new imports
  createPaymentMethod,
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

// Protected routes (require authentication)
StripeRouter.use(Authenticated);

// Payment routes
StripeRouter.post("/create-payment-intent", createPaymentIntent);
StripeRouter.post("/process-payment", processPayment);
StripeRouter.post("/refund", refundPayment);

// Payment information routes
StripeRouter.get("/payment/:paymentIntentId", getPaymentDetails);
StripeRouter.get("/history", getStripePaymentHistory);

// Payment Methods routes
StripeRouter.post("/payment-methods", createPaymentMethod);
StripeRouter.get("/payment-methods", getUserPaymentMethods);
StripeRouter.delete("/payment-methods/:paymentMethodId", deletePaymentMethod);
StripeRouter.put("/payment-methods/:paymentMethodId", updatePaymentMethod);

export default StripeRouter;
