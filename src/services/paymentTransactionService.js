// src/services/PaymentTransactionService.js
import mongoose from "mongoose";
import { ApiError } from "../helpers/ApiError.js";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import TransactionServiceV2 from "./TransactionService.js";

class PaymentTransactionService {
  /**
   * Process payment transaction - creates bank transaction when Stripe payment succeeds
   */
  static async processPaymentTransaction(paymentData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        paymentIntentId,
        customerEmail,
        amount,
        currency,
        productId,
        productName,
        quantity,
        userId, // User making the payment
        merchantAccountId, // Merchant's account to receive payment
        paymentMethod = "stripe",
        description,
      } = paymentData;

      // Validate required fields
      if (!paymentIntentId || !amount || !userId) {
        throw new ApiError(400, "Missing required payment data");
      }

      // Find customer's account
      const customerAccount = await Account.findOne({
        userId: userId,
        status: "active",
      }).session(session);

      if (!customerAccount) {
        throw new ApiError(404, "Customer account not found or inactive");
      }

      // Find merchant account (or use system account)
      let merchantAccount;
      if (merchantAccountId) {
        merchantAccount = await Account.findById(merchantAccountId).session(
          session
        );
      } else {
        // Use system merchant account or create one
        merchantAccount = await Account.findOne({
          accountType: "business",
          accountNumber: "MERCHANT_001", // Your system merchant account
        }).session(session);
      }

      if (!merchantAccount) {
        throw new ApiError(404, "Merchant account not found");
      }

      // Check if payment transaction already exists
      const existingTransaction = await Transaction.findOne({
        "metadata.paymentIntentId": paymentIntentId,
      }).session(session);

      if (existingTransaction) {
        throw new ApiError(409, "Payment transaction already processed");
      }

      // Create payment transaction record
      const paymentTransaction = new Transaction({
        fromAccount: customerAccount._id,
        toAccount: merchantAccount._id,
        amount: parseFloat(amount),
        type: "payment",
        description: description || `Payment for ${productName || "product"}`,
        status: "completed",
        reference: `PAY_${paymentIntentId}_${Date.now()}`,
        processAt: new Date(),
        metadata: {
          paymentIntentId,
          paymentMethod,
          customerEmail,
          productId,
          productName,
          quantity: parseInt(quantity) || 1,
          currency,
          stripeProcessed: true,
          transactionType: "online_payment",
        },
      });

      await paymentTransaction.save({ session });

      // Update account balances (optional - depends on your business logic)
      // You might want to track virtual balances or just keep records
      // Uncomment below if you want to update actual balances
      /*
      customerAccount.balance -= parseFloat(amount);
      merchantAccount.balance += parseFloat(amount);
      
      await customerAccount.save({ session });
      await merchantAccount.save({ session });
      */

      await session.commitTransaction();

      return {
        success: true,
        transaction: paymentTransaction,
        customerAccount: {
          accountNumber: customerAccount.accountNumber,
          balance: customerAccount.balance,
        },
        merchantAccount: {
          accountNumber: merchantAccount.accountNumber,
          balance: merchantAccount.balance,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Process refund transaction
   */
  static async processRefundTransaction(refundData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { originalPaymentIntentId, refundId, amount, reason, userId } =
        refundData;

      // Find original payment transaction
      const originalTransaction = await Transaction.findOne({
        "metadata.paymentIntentId": originalPaymentIntentId,
        type: "payment",
      }).session(session);

      if (!originalTransaction) {
        throw new ApiError(404, "Original payment transaction not found");
      }

      // Create refund transaction
      const refundTransaction = new Transaction({
        fromAccount: originalTransaction.toAccount,
        toAccount: originalTransaction.fromAccount,
        amount: parseFloat(amount),
        type: "refund",
        description: `Refund for payment ${originalPaymentIntentId}`,
        status: "completed",
        reference: `REF_${refundId}_${Date.now()}`,
        processAt: new Date(),
        metadata: {
          originalPaymentIntentId,
          refundId,
          reason,
          paymentMethod: "stripe",
          originalTransactionId: originalTransaction._id,
          transactionType: "payment_refund",
        },
      });

      await refundTransaction.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        refundTransaction,
        originalTransaction,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get payment history for a user
   */
  static async getPaymentHistory(userId, filters = {}, page = 1, limit = 10) {
    try {
      // Find user's accounts
      const userAccounts = await Account.find({ userId }).select("_id");
      const accountIds = userAccounts.map((acc) => acc._id);

      if (accountIds.length === 0) {
        return {
          transactions: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalTransactions: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }

      // Build query
      const query = {
        $or: [
          { fromAccount: { $in: accountIds } },
          { toAccount: { $in: accountIds } },
        ],
        type: { $in: ["payment", "refund"] },
      };

      // Apply filters
      if (filters.type) {
        query.type = filters.type;
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
      }

      if (filters.amountMin || filters.amountMax) {
        query.amount = {};
        if (filters.amountMin)
          query.amount.$gte = parseFloat(filters.amountMin);
        if (filters.amountMax)
          query.amount.$lte = parseFloat(filters.amountMax);
      }

      const skip = (page - 1) * limit;

      const [transactions, totalCount] = await Promise.all([
        Transaction.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("fromAccount", "accountNumber accountType")
          .populate("toAccount", "accountNumber accountType"),
        Transaction.countDocuments(query),
      ]);

      return {
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalTransactions: totalCount,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment statistics for a user
   */
  static async getPaymentStatistics(userId, period = "month") {
    try {
      const userAccounts = await Account.find({ userId }).select("_id");
      const accountIds = userAccounts.map((acc) => acc._id);

      if (accountIds.length === 0) {
        return { statistics: {} };
      }

      // Calculate date range
      const now = new Date();
      let startDate;

      switch (period) {
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "quarter":
          startDate = new Date(
            now.getFullYear(),
            Math.floor(now.getMonth() / 3) * 3,
            1
          );
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const statistics = await Transaction.aggregate([
        {
          $match: {
            $or: [
              { fromAccount: { $in: accountIds } },
              { toAccount: { $in: accountIds } },
            ],
            type: { $in: ["payment", "refund"] },
            createdAt: { $gte: startDate },
            status: "completed",
          },
        },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            avgAmount: { $avg: "$amount" },
          },
        },
      ]);

      const formattedStats = {};
      statistics.forEach((stat) => {
        formattedStats[stat._id] = {
          count: stat.count,
          totalAmount: parseFloat(stat.totalAmount.toFixed(2)),
          avgAmount: parseFloat(stat.avgAmount.toFixed(2)),
        };
      });

      return {
        period,
        startDate,
        endDate: now,
        statistics: formattedStats,
      };
    } catch (error) {
      throw error;
    }
  }
}

export default PaymentTransactionService;
