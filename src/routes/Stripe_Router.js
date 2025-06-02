import express from "express";
import {
  getAllProducts,
  createPaymentIntent,
  confirmPayment,
  handleWebhook,
  getProductPurchases,
} from "../controller/Stripe_Controller.js";

const StripeRouter = express.Router();

// Product routes
StripeRouter.get("/products", getAllProducts);
StripeRouter.get("/products/:productId/purchases", getProductPurchases);

// Payment routes
StripeRouter.post("/create-payment-intent", createPaymentIntent);
StripeRouter.post("/confirm-payment", confirmPayment);

// Webhook route (should be raw body, not JSON parsed)
StripeRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

export default StripeRouter;
