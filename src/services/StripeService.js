import Stripe from "stripe";
import { ApiError } from "../helpers/ApiError.js";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js"; // Assuming you have a User model
import { ConfigENV } from "../config/index.js";

class StripeService {
  constructor() {
    // if (ConfigENV.STRIPE_SECRET_KEY) {
    //     throw new Error("STRIPE_SECRET_KEY is required in environment variables");
    // }
    this.stripe = new Stripe(ConfigENV.STRIPE_SECRET_KEY);
  }

  async createOrGetCustomer(userData, userId) {
    try {
      const { email, name, phone } = userData;

      // Check if customer already exists in Stripe
      const existingCustomers = await this.stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email,
        name,
        phone,
        metadata: {
          internal_user_id: userId,
          created_via: "bank_management_system",
        },
      });

      return customer;
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to create/retrieve Stripe customer: ${error.message}`
      );
    }
  }

  async createPaymentIntent(paymentData) {
    try {
      const {
        amount,
        currency = "₹",
        accountId,
        userId,
        description = "Bank payment",
        paymentMethodId,
        customerData,
        metadata = {},
      } = paymentData;

      // Validate amount
      if (!amount || amount <= 0) {
        throw new ApiError(400, "Payment amount must be greater than zero");
      }

      // Validate account
      const account = await Account.findById(accountId);
      if (!account) {
        throw new ApiError(404, "Account not found");
      }

      if (account.status !== "active") {
        throw new ApiError(
          400,
          `Cannot process payment for ${account.status} account`
        );
      }

      // Create or get Stripe customer
      const customer = await this.createOrGetCustomer(customerData, userId);

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        customer: customer.id,
        payment_method: paymentMethodId,
        description,
        confirm: paymentMethodId ? true : false, // Auto-confirm if payment method provided
        metadata: {
          account_id: accountId,
          user_id: userId,
          account_number: account.accountNumber,
          ...metadata,
        },
      });

      // Create pending transaction record
      const transaction = new Transaction({
        toAccount: accountId,
        amount,
        type: "deposit",
        description,
        status: "pending",
        reference: `STRIPE_${paymentIntent.id}`,
        metadata: {
          stripe_payment_intent_id: paymentIntent.id,
          stripe_customer_id: customer.id,
          currency,
          ...metadata,
        },
      });

      await transaction.save();

      return {
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          status: paymentIntent.status,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
        },
        customer: {
          id: customer.id,
          email: customer.email,
        },
        transaction: {
          id: transaction._id,
          reference: transaction.reference,
          status: transaction.status,
        },
        message: "Payment intent created successfully",
      };
    } catch (error) {
      throw new ApiError(
        500,
        `Payment intent creation failed: ${error.message}`
      );
    }
  }

  async processPayment(paymentData) {
    try {
      const {
        amount,
        currency = "usd",
        accountId,
        userId,
        description = "Bank payment",
        paymentMethodId,
        customerData,
        metadata = {},
      } = paymentData;

      // Validate inputs
      if (!amount || amount <= 0) {
        throw new ApiError(400, "Payment amount must be greater than zero");
      }

      //   if (!paymentMethodId) {
      //     throw new ApiError(400, "Payment method is required");
      //   }

      // Validate account
      const account = await Account.findById(accountId);
      if (!account) {
        throw new ApiError(404, "Account not found");
      }

      if (account.status !== "active") {
        throw new ApiError(
          400,
          `Cannot process payment for ${account.status} account`
        );
      }

      // Create or get customer
      const customer = await this.createOrGetCustomer(customerData, userId);

      // Create payment intent and confirm immediately
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        customer: customer.id,
        payment_method: paymentMethodId,
        description,
        confirm: true,
        metadata: {
          account_id: accountId,
          user_id: userId,
          account_number: account.accountNumber,
          ...metadata,
        },
      });

      // Create transaction record
      const transaction = new Transaction({
        toAccount: accountId,
        amount,
        type: "stripe_payment",
        description,
        status: paymentIntent.status === "succeeded" ? "completed" : "failed",
        reference: `STRIPE_${paymentIntent.id}`,
        processAt: paymentIntent.status === "succeeded" ? new Date() : null,
        metadata: {
          stripe_payment_intent_id: paymentIntent.id,
          stripe_customer_id: customer.id,
          currency,
          stripe_charges: paymentIntent.charges?.data || [],
          ...metadata,
        },
      });

      await transaction.save();

      // Update account balance if payment succeeded
      if (paymentIntent.status === "succeeded") {
        account.balance += amount;
        await account.save();
      }

      return {
        success: paymentIntent.status === "succeeded",
        payment: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          charges: paymentIntent.charges?.data || [],
        },
        transaction: {
          id: transaction._id,
          reference: transaction.reference,
          status: transaction.status,
        },
        account: {
          accountNumber: account.accountNumber,
          newBalance: account.balance,
          currency: account.currency,
        },
        message:
          paymentIntent.status === "succeeded"
            ? "Payment processed successfully"
            : `Payment ${paymentIntent.status}`,
      };
    } catch (error) {
      // Handle Stripe-specific errors
      if (error.type === "StripeCardError") {
        throw new ApiError(400, `Card error: ${error.message}`);
      } else if (error.type === "StripeInvalidRequestError") {
        throw new ApiError(400, `Invalid request: ${error.message}`);
      } else if (error.type === "StripeAuthenticationError") {
        throw new ApiError(401, "Stripe authentication failed");
      } else if (error.type === "StripeConnectionError") {
        throw new ApiError(503, "Network error occurred");
      } else if (error.type === "StripeRateLimitError") {
        throw new ApiError(429, "Too many requests");
      }

      throw new ApiError(500, `Payment processing failed: ${error.message}`);
    }
  }

  /**
   * Handle Stripe webhooks
   * @param {string} payload - Webhook payload
   * @param {string} signature - Stripe signature
   * @returns {Object} Webhook processing result
   */
  async handleWebhook(payload, signature) {
    try {
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!endpointSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
      }

      // Verify webhook signature
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        endpointSecret
      );

      switch (event.type) {
        case "payment_intent.succeeded":
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case "payment_intent.payment_failed":
          await this.handlePaymentFailed(event.data.object);
          break;
        case "charge.dispute.created":
          await this.handleDisputeCreated(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { success: true, message: "Webhook processed successfully" };
    } catch (error) {
      throw new ApiError(400, `Webhook error: ${error.message}`);
    }
  }

  /**
   * Handle successful payment webhook
   * @param {Object} paymentIntent - Stripe payment intent object
   */
  async handlePaymentSucceeded(paymentIntent) {
    try {
      const transaction = await Transaction.findOne({
        reference: `STRIPE_${paymentIntent.id}`,
      });

      if (transaction && transaction.status === "pending") {
        // Update transaction status
        transaction.status = "completed";
        transaction.processAt = new Date();
        transaction.metadata.stripe_charges = paymentIntent.charges?.data || [];
        await transaction.save();

        // Update account balance
        const account = await Account.findById(transaction.toAccount);
        if (account) {
          account.balance += transaction.amount;
          await account.save();
        }

        console.log(
          `Payment succeeded for transaction: ${transaction.reference}`
        );
      }
    } catch (error) {
      console.error("Error handling payment success webhook:", error);
    }
  }

  /**
   * Handle failed payment webhook
   * @param {Object} paymentIntent - Stripe payment intent object
   */
  async handlePaymentFailed(paymentIntent) {
    try {
      const transaction = await Transaction.findOne({
        reference: `STRIPE_${paymentIntent.id}`,
      });

      if (transaction && transaction.status === "pending") {
        transaction.status = "failed";
        transaction.metadata.failure_reason =
          paymentIntent.last_payment_error?.message || "Payment failed";
        await transaction.save();

        console.log(`Payment failed for transaction: ${transaction.reference}`);
      }
    } catch (error) {
      console.error("Error handling payment failure webhook:", error);
    }
  }

  /**
   * Handle dispute created webhook
   * @param {Object} dispute - Stripe dispute object
   */
  async handleDisputeCreated(dispute) {
    try {
      const chargeId = dispute.charge;
      const charge = await this.stripe.charges.retrieve(chargeId);

      // Find related transaction
      const transaction = await Transaction.findOne({
        reference: `STRIPE_${charge.payment_intent}`,
      });

      if (transaction) {
        // Add dispute information to transaction metadata
        transaction.metadata.dispute = {
          id: dispute.id,
          amount: dispute.amount / 100,
          reason: dispute.reason,
          status: dispute.status,
          created_at: new Date(dispute.created * 1000),
        };
        await transaction.save();

        console.log(
          `Dispute created for transaction: ${transaction.reference}`
        );
      }
    } catch (error) {
      console.error("Error handling dispute webhook:", error);
    }
  }

  /**
   * Refund a payment
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @param {number} amount - Refund amount (optional, defaults to full refund)
   * @param {string} reason - Refund reason
   * @returns {Object} Refund result
   */
  async refundPayment(
    paymentIntentId,
    amount = null,
    reason = "requested_by_customer"
  ) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        paymentIntentId
      );

      if (!paymentIntent.charges?.data?.[0]) {
        throw new ApiError(400, "No charge found for this payment intent");
      }

      const charge = paymentIntent.charges.data[0];

      const refundData = {
        charge: charge.id,
        reason,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      const refund = await this.stripe.refunds.create(refundData);

      // Create refund transaction record
      const originalTransaction = await Transaction.findOne({
        reference: `STRIPE_${paymentIntentId}`,
      });

      if (originalTransaction) {
        const refundTransaction = new Transaction({
          fromAccount: originalTransaction.toAccount,
          amount: refund.amount / 100,
          type: "refund",
          description: `Refund for ${originalTransaction.description}`,
          status: "completed",
          reference: `REFUND_${refund.id}`,
          processAt: new Date(),
          metadata: {
            stripe_refund_id: refund.id,
            original_transaction_id: originalTransaction._id,
            refund_reason: reason,
          },
        });

        await refundTransaction.save();

        // Update account balance
        const account = await Account.findById(originalTransaction.toAccount);
        if (account) {
          account.balance -= refund.amount / 100;
          await account.save();
        }
      }

      return {
        success: true,
        refund: {
          id: refund.id,
          amount: refund.amount / 100,
          status: refund.status,
          reason: refund.reason,
        },
        message: "Refund processed successfully",
      };
    } catch (error) {
      throw new ApiError(500, `Refund processing failed: ${error.message}`);
    }
  }

  /**
   * Get payment details
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @returns {Object} Payment details
   */
  async getPaymentDetails(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        paymentIntentId,
        {
          expand: ["customer", "charges.data.balance_transaction"],
        }
      );

      const transaction = await Transaction.findOne({
        reference: `STRIPE_${paymentIntentId}`,
      }).populate("toAccount", "accountNumber accountType");

      return {
        stripe_details: {
          id: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          customer: paymentIntent.customer,
          charges: paymentIntent.charges?.data || [],
          created: new Date(paymentIntent.created * 1000),
        },
        internal_transaction: transaction,
      };
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to retrieve payment details: ${error.message}`
      );
    }
  }
}

export default StripeService;
