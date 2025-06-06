import Stripe from "stripe";
import { ApiError } from "../helpers/ApiError.js";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import { ConfigENV } from "../config/index.js";

class StripeService {
  constructor() {
    this.stripe = new Stripe(ConfigENV.STRIPE_SECRET_KEY);
  }

  async createOrGetCustomer(userData, userId) {
    try {
      const { email, name, phone } = userData;

      const existingCustomers = await this.stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
      }

      const customer = await this.stripe.customers.create({
        email,
        name,
        phone,
        metadata: {
          internal_user_id: userId,
        },
      });

      return customer;
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to create/retrieve customer: ${error.message}`
      );
    }
  }

  async createPaymentMethod(cardData, customerId) {
    try {
      const { number, exp_month, exp_year, cvc, name, email, phone } = cardData;

      const paymentMethod = await this.stripe.paymentMethods.create({
        type: "card",
        card: {
          number,
          exp_month,
          exp_year,
          cvc,
        },
        billing_details: {
          name,
          email,
          phone,
        },
      });

      if (customerId) {
        await this.stripe.paymentMethods.attach(paymentMethod.id, {
          customer: customerId,
        });
      }

      return {
        success: true,
        paymentMethod: {
          id: paymentMethod.id,
          card: {
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4,
            exp_month: paymentMethod.card.exp_month,
            exp_year: paymentMethod.card.exp_year,
          },
          billing_details: paymentMethod.billing_details,
        },
      };
    } catch (error) {
      throw new ApiError(
        500,
        `Payment method creation failed: ${error.message}`
      );
    }
  }

  async getUserPaymentMethods(customerId) {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      return {
        success: true,
        paymentMethods: paymentMethods.data.map((pm) => ({
          id: pm.id,
          card: {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          },
          billing_details: pm.billing_details,
        })),
      };
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to retrieve payment methods: ${error.message}`
      );
    }
  }

  async deletePaymentMethod(paymentMethodId) {
    try {
      await this.stripe.paymentMethods.detach(paymentMethodId);
      return {
        success: true,
        message: "Payment method deleted successfully",
      };
    } catch (error) {
      throw new ApiError(
        500,
        `Payment method deletion failed: ${error.message}`
      );
    }
  }

  async handlePayment(paymentData, action = "create") {
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

      if (!amount || amount <= 0) {
        throw new ApiError(400, "Payment amount must be greater than zero");
      }

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

      const customer = await this.createOrGetCustomer(customerData, userId);

      const confirmPayment = action === "process";

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        customer: customer.id,
        payment_method: paymentMethodId,
        description,
        confirm: confirmPayment,
        metadata: {
          account_id: accountId,
          user_id: userId,
          account_number: account.accountNumber,
          ...metadata,
        },
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
      });

      const transaction = new Transaction({
        toAccount: accountId,
        amount,
        type: action === "process" ? "payment" : "deposit",
        description,
        status:
          action === "process"
            ? paymentIntent.status === "succeeded"
              ? "completed"
              : "failed"
            : "pending",
        reference: `STRIPE_${paymentIntent.id}`,
        processAt:
          action === "process" && paymentIntent.status === "succeeded"
            ? new Date()
            : null,
        metadata: {
          stripe_payment_intent_id: paymentIntent.id,
          stripe_customer_id: customer.id,
          currency,
          ...metadata,
        },
      });

      await transaction.save();

      if (action === "process" && paymentIntent.status === "succeeded") {
        account.balance += amount;
        await account.save();
      }

      const baseResponse = {
        success:
          action === "process" ? paymentIntent.status === "succeeded" : true,
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
      };

      if (action === "process") {
        baseResponse.account = {
          accountNumber: account.accountNumber,
          newBalance: account.balance,
        };
      }

      return baseResponse;
    } catch (error) {
      if (error.type === "StripeCardError") {
        throw new ApiError(400, `Card error: ${error.message}`);
      }
      throw new ApiError(500, `Stripe Payment failed: ${error.message}`);
    }
  }

  async handleWebhook(payload, signature) {
    try {
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!endpointSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
      }

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
      }

      return { success: true, message: "Webhook processed successfully" };
    } catch (error) {
      throw new ApiError(400, `Webhook error: ${error.message}`);
    }
  }

  async handlePaymentSucceeded(paymentIntent) {
    try {
      const transaction = await Transaction.findOne({
        reference: `STRIPE_${paymentIntent.id}`,
      });

      if (transaction && transaction.status === "pending") {
        transaction.status = "completed";
        transaction.processAt = new Date();
        await transaction.save();

        const account = await Account.findById(transaction.toAccount);
        if (account) {
          account.balance += transaction.amount;
          await account.save();
        }
      }
    } catch (error) {
      console.error("Error handling payment success webhook:", error);
    }
  }

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
      }
    } catch (error) {
      console.error("Error handling payment failure webhook:", error);
    }
  }

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
        refundData.amount = Math.round(amount * 100);
      }

      const refund = await this.stripe.refunds.create(refundData);

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
      };
    } catch (error) {
      throw new ApiError(500, `Refund processing failed: ${error.message}`);
    }
  }

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

  async handleTransfer(transferData) {
    try {
      const {
        fromAccount,
        toAccount,
        amount,
        currency = "usd",
        userId,
        description = "Stripe transfer",
        paymentMethodId,
        customerData,
        transferType = "instant",
        metadata = {},
      } = transferData;

      // Validate accounts
      if (fromAccount.status !== "active") {
        throw new ApiError(
          400,
          `Cannot transfer from ${fromAccount.status} account`
        );
      }

      if (toAccount.status !== "active") {
        throw new ApiError(
          400,
          `Cannot transfer to ${toAccount.status} account`
        );
      }

      if (fromAccount.currency !== toAccount.currency) {
        throw new ApiError(400, "Currency mismatch between accounts");
      }

      // Calculate fees
      const transferFee = this.calculateStripeTransferFee(amount, transferType);
      const totalAmount = amount + transferFee;

      // Check if we need to use Stripe payment method for funding
      const needsExternalFunding = fromAccount.balance < totalAmount;

      let paymentIntent = null;
      let customer = null;

      if (needsExternalFunding && paymentMethodId && customerData) {
        // Create payment intent to fund the transfer
        customer = await this.createOrGetCustomer(customerData, userId);

        const fundingAmount = totalAmount - fromAccount.balance;

        paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(fundingAmount * 100),
          currency: currency.toLowerCase(),
          customer: customer.id,
          payment_method: paymentMethodId,
          description: `Funding for transfer: ${description}`,
          confirm: true,
          metadata: {
            funding_for_transfer: "true",
            from_account_id: fromAccount._id.toString(),
            to_account_id: toAccount._id.toString(),
            original_transfer_amount: amount.toString(),
            ...metadata,
          },
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
        });

        if (paymentIntent.status !== "succeeded") {
          throw new ApiError(
            400,
            "Failed to fund transfer with payment method"
          );
        }

        // Add funded amount to source account
        fromAccount.balance += fundingAmount;
        await fromAccount.save();
      } else if (needsExternalFunding) {
        throw new ApiError(400, "Insufficient funds for transfer");
      }

      // Create Stripe Transfer (if using Stripe Connect)
      let stripeTransfer = null;
      if (toAccount.stripeAccountId) {
        // This requires Stripe Connect setup
        stripeTransfer = await this.stripe.transfers.create({
          amount: Math.round(amount * 100),
          currency: currency.toLowerCase(),
          destination: toAccount.stripeAccountId,
          description,
          metadata: {
            from_account_number: fromAccount.accountNumber,
            to_account_number: toAccount.accountNumber,
            ...metadata,
          },
        });
      }

      // Create transfer transaction record
      const transaction = new Transaction({
        fromAccount: fromAccount._id,
        toAccount: toAccount._id,
        amount,
        type: "transfer",
        description,
        status: "pending",
        reference: `STRP_TRF_${Date.now()}${Math.floor(Math.random() * 1000)}`,
        metadata: {
          stripe_transfer_id: stripeTransfer?.id,
          stripe_payment_intent_id: paymentIntent?.id,
          stripe_customer_id: customer?.id,
          transfer_fee: transferFee,
          total_deduction: totalAmount,
          transfer_type: transferType,
          external_funding_used: needsExternalFunding,
          ...metadata,
        },
      });

      await transaction.save();

      // Process the transfer
      fromAccount.balance -= totalAmount;
      toAccount.balance += amount;

      await Promise.all([fromAccount.save(), toAccount.save()]);

      // Create fee transaction if applicable
      if (transferFee > 0) {
        const feeTransaction = new Transaction({
          fromAccount: fromAccount._id,
          amount: transferFee,
          type: "fee",
          description: `Transfer fee for ${transaction.reference}`,
          status: "completed",
          reference: `STRP_FEE_${Date.now()}${Math.floor(
            Math.random() * 1000
          )}`,
          processAt: new Date(),
          metadata: {
            relatedTransactionID: transaction._id,
            transfer_type: transferType,
          },
        });

        await feeTransaction.save();
      }

      // Update transaction status
      transaction.status = "completed";
      transaction.processAt = new Date();
      await transaction.save();

      // Prepare response
      const response = {
        success: true,
        transaction: {
          id: transaction._id,
          reference: transaction.reference,
          status: transaction.status,
          amount,
          transferFee: transferFee > 0 ? transferFee : null,
        },
        fromAccount: {
          accountNumber: fromAccount.accountNumber,
          newBalance: fromAccount.balance,
          currency: fromAccount.currency,
        },
        toAccount: {
          accountNumber: toAccount.accountNumber,
          newBalance: toAccount.balance,
          currency: toAccount.currency,
        },
        stripe: {
          transferId: stripeTransfer?.id || null,
          paymentIntentId: paymentIntent?.id || null,
          customerId: customer?.id || null,
        },
        externalFundingUsed: needsExternalFunding,
      };

      return response;
    } catch (error) {
      if (error.type === "StripeCardError") {
        throw new ApiError(400, `Card error: ${error.message}`);
      }
      if (error.type === "StripeInvalidRequestError") {
        throw new ApiError(400, `Invalid request: ${error.message}`);
      }
      throw new ApiError(500, `Stripe Transfer failed: ${error.message}`);
    }
  }
  calculateStripeTransferFee(amount, transferType = "instant") {
    // Stripe transfer fees (adjust based on your Stripe pricing)
    const fees = {
      instant: Math.max(0.5, amount * 0.015), // 1.5% with $0.50 minimum
      standard: 0.25, // Flat $0.25 for standard transfers
    };

    return fees[transferType] || fees.standard;
  }
}

export default StripeService;
