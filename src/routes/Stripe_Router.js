import express from "express";
import {
  createPaymentIntent,
  processPayment,
  handleStripeWebhook,
  refundPayment,
  getPaymentDetails,
  getStripePaymentHistory,
} from "../controller/StripeV2.js";
import { Authenticated } from "../middleware/authMiddleware.js"; // Assuming you have auth middleware

const StripeRouter = express.Router();

// Public webhook endpoint (no auth required)
StripeRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Protected routes (require authentication)
StripeRouter.use(Authenticated); // Apply authentication to all routes below

// Payment routes
StripeRouter.post("/create-payment-intent", createPaymentIntent);
StripeRouter.post("/process-payment", processPayment);
StripeRouter.post("/refund", refundPayment);

// Payment information routes
StripeRouter.get("/payment/:paymentIntentId", getPaymentDetails);
StripeRouter.get("/history", getStripePaymentHistory);

export default StripeRouter;
