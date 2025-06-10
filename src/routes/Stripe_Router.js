// import express from "express";
// import {
//   createPaymentIntent,
//   processPayment,
//   handleStripeWebhook,
//   refundPayment,
//   getPaymentDetails,
//   getStripePaymentHistory,
//   createPaymentMethod,
//   getUserPaymentMethods,
//   deletePaymentMethod,
// } from "../controller/StripeV2.js";
// import { Authenticated } from "../middleware/authMiddleware.js";

// const StripeRouter = express.Router();

// StripeRouter.post(
//   "/webhook",
//   express.raw({ type: "application/json" }),
//   handleStripeWebhook
// );

// StripeRouter.use(Authenticated);

// StripeRouter.post("/create-payment-intent", createPaymentIntent);
// StripeRouter.post("/process-payment", processPayment);
// StripeRouter.post("/refund", refundPayment);
// StripeRouter.get("/payment/:paymentIntentId", getPaymentDetails);
// StripeRouter.get("/history", getStripePaymentHistory);

// StripeRouter.post("/payment-methods", createPaymentMethod);
// StripeRouter.get("/payment-methods", getUserPaymentMethods);
// StripeRouter.delete("/payment-methods/:paymentMethodId", deletePaymentMethod);

// export default StripeRouter;
