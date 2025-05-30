// src/utils/TransactionService.js
import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";
import { ApiError } from "../helpers/ApiError.js";
import mongoose from "mongoose";

class TransactionService {
  /**
   * Deposit funds to an account
   * @param {string} accountId - Target account ID
   * @param {number} amount - Deposit amount
   * @param {string} description - Transaction description
   * @param {object} metadata - Additional transaction data
   * @returns {object} Transaction result
   */
  static async depositFunds(
    accountId,
    amount,
    description = "Deposit",
    metadata = {}
  ) {
    try {
      if (amount <= 0) {
        throw new ApiError(400, "Deposit amount must be greater than zero");
      }

      // Find and validate account
      const account = await Account.findById(accountId);
      if (!account) {
        throw new ApiError(404, "Account not found");
      }

      if (account.status !== "active") {
        throw new ApiError(400, `Cannot deposit to ${account.status} account`);
      }

      // Create transaction record
      const transaction = new Transaction({
        toAccount: accountId,
        amount,
        type: "deposit",
        description,
        status: "pending",
        reference: `DEP${Date.now()}${Math.floor(Math.random() * 1000)}`,
        metadata,
      });

      await transaction.save();

      // Update account balance
      account.balance += amount;
      await account.save();

      // Mark transaction as completed
      transaction.status = "completed";
      transaction.processedAt = new Date();
      await transaction.save();

      return {
        transaction,
        account: {
          accountNumber: account.accountNumber,
          newBalance: account.balance,
          currency: account.currency,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Withdraw funds from an account
   * @param {string} accountId - Source account ID
   * @param {number} amount - Withdrawal amount
   * @param {string} description - Transaction description
   * @param {object} metadata - Additional transaction data
   * @returns {object} Transaction result
   */
  static async withdrawFunds(
    accountId,
    amount,
    description = "Withdrawal",
    metadata = {}
  ) {
    try {
      if (amount <= 0) {
        throw new ApiError(400, "Withdrawal amount must be greater than zero");
      }

      // Find and validate account
      const account = await Account.findById(accountId);
      if (!account) {
        throw new ApiError(404, "Account not found");
      }

      if (account.status !== "active") {
        throw new ApiError(
          400,
          `Cannot withdraw from ${account.status} account`
        );
      }

      // Check sufficient balance
      if (account.balance < amount) {
        throw new ApiError(400, "Insufficient funds");
      }

      // Apply minimum balance rules for certain account types
      const minBalance = this.getMinimumBalance(account.accountType);
      if (account.balance - amount < minBalance) {
        throw new ApiError(
          400,
          `Withdrawal would breach minimum balance requirement of ${account.currency}${minBalance}`
        );
      }

      // Create transaction record
      const transaction = new Transaction({
        fromAccount: accountId,
        amount,
        type: "withdrawal",
        description,
        status: "pending",
        reference: `WTH${Date.now()}${Math.floor(Math.random() * 1000)}`,
        metadata,
      });

      await transaction.save();

      // Update account balance
      account.balance -= amount;
      await account.save();

      // Mark transaction as completed
      transaction.status = "completed";
      transaction.processedAt = new Date();
      await transaction.save();

      return {
        transaction,
        account: {
          accountNumber: account.accountNumber,
          newBalance: account.balance,
          currency: account.currency,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  static async transferFunds(
    fromAccountId,
    toAccountId,
    amount,
    description = "Transfer",
    metadata = {}
  ) {
    try {
      if (amount <= 0) {
        throw new ApiError(400, "Transfer amount must be greater than zero");
      }

      if (fromAccountId === toAccountId) {
        throw new ApiError(400, "Cannot transfer to the same account");
      }

      // Find and validate both accounts
      const [fromAccount, toAccount] = await Promise.all([
        Account.findById(fromAccountId),
        Account.findById(toAccountId),
      ]);

      if (!fromAccount) {
        throw new ApiError(404, "Source account not found");
      }

      if (!toAccount) {
        throw new ApiError(404, "Destination account not found");
      }

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

      // Check currency compatibility
      if (fromAccount.currency !== toAccount.currency) {
        throw new ApiError(400, "Currency mismatch between accounts");
      }

      // Check sufficient balance
      if (fromAccount.balance < amount) {
        throw new ApiError(400, "Insufficient funds in source account");
      }

      // Apply minimum balance rules
      const minBalance = this.getMinimumBalance(fromAccount.accountType);
      if (fromAccount.balance - amount < minBalance) {
        throw new ApiError(
          400,
          `Transfer would breach minimum balance requirement of ${fromAccount.currency}${minBalance}`
        );
      }

      // Calculate transfer fee (if applicable)
      const transferFee = this.calculateTransferFee(
        fromAccount,
        toAccount,
        amount
      );
      const totalDeduction = amount + transferFee;

      if (fromAccount.balance < totalDeduction) {
        throw new ApiError(
          400,
          `Insufficient funds (including transfer fee of ${fromAccount.currency}${transferFee})`
        );
      }

      // Create transaction record
      const transaction = new Transaction({
        fromAccount: fromAccountId,
        toAccount: toAccountId,
        amount,
        type: "transfer",
        description,
        status: "pending",
        reference: `TRF${Date.now()}${Math.floor(Math.random() * 1000)}`,
        metadata: {
          ...metadata,
          transferFee,
          totalDeduction,
        },
      });

      await transaction.save();

      // Update account balances
      fromAccount.balance -= totalDeduction;
      toAccount.balance += amount;

      await Promise.all([fromAccount.save(), toAccount.save()]);

      // Create fee transaction if there's a fee
      if (transferFee > 0) {
        const feeTransaction = new Transaction({
          fromAccount: fromAccountId,
          amount: transferFee,
          type: "fee",
          description: "Transfer fee",
          status: "completed",
          reference: `FEE${Date.now()}${Math.floor(Math.random() * 1000)}`,
          processedAt: new Date(),
          metadata: { relatedTransactionId: transaction._id },
        });
        await feeTransaction.save();
      }

      // Mark transaction as completed
      transaction.status = "completed";
      transaction.processedAt = new Date();
      await transaction.save();

      return {
        transaction,
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
        transferFee: transferFee > 0 ? transferFee : null,
      };
    } catch (error) {
      throw error;
    }
  }

  static async getAccountBalance(accountId, limit = 10) {
    try {
      const account = await Account.findById(accountId);
      if (!account) {
        throw new ApiError(404, "Account not found");
      }

      const recentTransactions = await Transaction.find({
        $or: [{ fromAccount: accountId }, { toAccount: accountId }],
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("fromAccount", "accountNumber accountType")
        .populate("toAccount", "accountNumber accountType");

      return {
        account: {
          accountNumber: account.accountNumber,
          accountType: account.accountType,
          balance: account.balance,
          currency: account.currency,
          status: account.status,
        },
        recentTransactions,
      };
    } catch (error) {
      throw error;
    }
  }

  static async getTransactionHistory(
    accountId,
    filters = {},
    page = 1,
    limit = 20
  ) {
    try {
      const account = await Account.findById(accountId);
      if (!account) {
        throw new ApiError(404, "Account not found");
      }

      // Build query
      const query = {
        $or: [{ fromAccount: accountId }, { toAccount: accountId }],
      };

      // Apply filters
      if (filters.type) {
        query.type = filters.type;
      }

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          query.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      if (filters.amountMin || filters.amountMax) {
        query.amount = {};
        if (filters.amountMin) {
          query.amount.$gte = parseFloat(filters.amountMin);
        }
        if (filters.amountMax) {
          query.amount.$lte = parseFloat(filters.amountMax);
        }
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get transactions
      const [transactions, totalCount] = await Promise.all([
        Transaction.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("fromAccount", "accountNumber accountType")
          .populate("toAccount", "accountNumber accountType"),
        Transaction.countDocuments(query),
      ]);

      // Calculate summary statistics
      const summary = await this.calculateTransactionSummary(
        accountId,
        filters
      );

      return {
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalTransactions: totalCount,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1,
        },
        summary,
      };
    } catch (error) {
      throw error;
    }
  }

  static async processInterestPayment(accountId) {
    try {
      const account = await Account.findById(accountId);
      if (!account) {
        throw new ApiError(404, "Account not found");
      }

      if (
        account.accountType !== "savings" &&
        account.accountType !== "investment"
      ) {
        throw new ApiError(
          400,
          "Interest is only applicable to savings and investment accounts"
        );
      }

      if (account.status !== "active") {
        throw new ApiError(400, "Cannot process interest for inactive account");
      }

      // Calculate monthly interest
      const interestAmount =
        (account.balance * account.interestRate) / (12 * 100);

      if (interestAmount <= 0) {
        throw new ApiError(400, "No interest to process");
      }

      // Create interest transaction
      const transaction = new Transaction({
        toAccount: accountId,
        amount: parseFloat(interestAmount.toFixed(2)),
        type: "interest",
        description: `Monthly interest payment at ${account.interestRate}% APR`,
        status: "completed",
        reference: `INT${Date.now()}${Math.floor(Math.random() * 1000)}`,
        processedAt: new Date(),
        metadata: {
          interestRate: account.interestRate,
          principalAmount: account.balance,
        },
      });

      await transaction.save();

      // Update account balance
      account.balance += parseFloat(interestAmount.toFixed(2));
      await account.save();

      return {
        transaction,
        account: {
          accountNumber: account.accountNumber,
          newBalance: account.balance,
          currency: account.currency,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  static async reverseTransaction(
    transactionId,
    reason = "Transaction reversal"
  ) {
    try {
      const originalTransaction = await Transaction.findById(transactionId);
      if (!originalTransaction) {
        throw new ApiError(404, "Transaction not found");
      }

      if (originalTransaction.status !== "completed") {
        throw new ApiError(400, "Can only reverse completed transactions");
      }

      // Check if already reversed
      const existingReversal = await Transaction.findOne({
        "metadata.reversedTransactionId": transactionId,
      });

      if (existingReversal) {
        throw new ApiError(400, "Transaction has already been reversed");
      }

      // Create reversal transaction based on original type
      let reversalTransaction;

      if (originalTransaction.type === "deposit") {
        // Reverse deposit = withdrawal
        const account = await Account.findById(originalTransaction.toAccount);
        if (account.balance < originalTransaction.amount) {
          throw new ApiError(400, "Insufficient funds to reverse deposit");
        }

        account.balance -= originalTransaction.amount;
        await account.save();

        reversalTransaction = new Transaction({
          fromAccount: originalTransaction.toAccount,
          amount: originalTransaction.amount,
          type: "withdrawal",
          description: `Reversal: ${reason}`,
          status: "completed",
          reference: `REV${Date.now()}${Math.floor(Math.random() * 1000)}`,
          processedAt: new Date(),
          metadata: {
            reversedTransactionId: transactionId,
            reversalReason: reason,
          },
        });

        await reversalTransaction.save();
      } else if (originalTransaction.type === "withdrawal") {
        // Reverse withdrawal = deposit
        const account = await Account.findById(originalTransaction.fromAccount);
        account.balance += originalTransaction.amount;
        await account.save();

        reversalTransaction = new Transaction({
          toAccount: originalTransaction.fromAccount,
          amount: originalTransaction.amount,
          type: "deposit",
          description: `Reversal: ${reason}`,
          status: "completed",
          reference: `REV${Date.now()}${Math.floor(Math.random() * 1000)}`,
          processedAt: new Date(),
          metadata: {
            reversedTransactionId: transactionId,
            reversalReason: reason,
          },
        });

        await reversalTransaction.save();
      } else if (originalTransaction.type === "transfer") {
        // Reverse transfer
        const [fromAccount, toAccount] = await Promise.all([
          Account.findById(originalTransaction.fromAccount),
          Account.findById(originalTransaction.toAccount),
        ]);

        if (toAccount.balance < originalTransaction.amount) {
          throw new ApiError(
            400,
            "Insufficient funds in destination account to reverse transfer"
          );
        }

        fromAccount.balance += originalTransaction.amount;
        toAccount.balance -= originalTransaction.amount;

        await Promise.all([fromAccount.save(), toAccount.save()]);

        reversalTransaction = new Transaction({
          fromAccount: originalTransaction.toAccount,
          toAccount: originalTransaction.fromAccount,
          amount: originalTransaction.amount,
          type: "transfer",
          description: `Reversal: ${reason}`,
          status: "completed",
          reference: `REV${Date.now()}${Math.floor(Math.random() * 1000)}`,
          processedAt: new Date(),
          metadata: {
            reversedTransactionId: transactionId,
            reversalReason: reason,
          },
        });

        await reversalTransaction.save();
      }

      return {
        originalTransaction,
        reversalTransaction,
      };
    } catch (error) {
      throw error;
    }
  }

  static getMinimumBalance(accountType) {
    const minimumBalances = {
      savings: 100,
      checking: 25,
      loan: 0,
      credit: 0,
      investment: 500,
    };
    return minimumBalances[accountType] || 0;
  }

  static calculateTransferFee(fromAccount, toAccount, amount) {
    // Same user transfers are free
    if (fromAccount.userId.toString() === toAccount.userId.toString()) {
      return 0;
    }

    // Different fee structures based on account types
    const baseFee = 2; // ₹2 base fee
    const percentageFee = 0.001; // 0.1% of amount

    let fee = baseFee + amount * percentageFee;

    // Cap the fee at ₹50
    fee = Math.min(fee, 50);

    // Minimum fee of ₹1 for external transfers
    fee = Math.max(fee, 1);

    return parseFloat(fee.toFixed(2));
  }

  static async calculateTransactionSummary(accountId, filters = {}) {
    try {
      const query = {
        $or: [{ fromAccount: accountId }, { toAccount: accountId }],
      };

      // Apply same filters as transaction history
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          query.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      const summary = await Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalDeposits: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "deposit"] },
                      {
                        $eq: [
                          "$toAccount",
                          new mongoose.Types.ObjectId(accountId),
                        ],
                      },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            totalWithdrawals: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "withdrawal"] },
                      {
                        $eq: [
                          "$fromAccount",
                          new mongoose.Types.ObjectId(accountId),
                        ],
                      },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            totalTransfersOut: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "transfer"] },
                      {
                        $eq: [
                          "$fromAccount",
                          new mongoose.Types.ObjectId(accountId),
                        ],
                      },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            totalTransfersIn: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "transfer"] },
                      {
                        $eq: [
                          "$toAccount",
                          new mongoose.Types.ObjectId(accountId),
                        ],
                      },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            totalInterest: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "interest"] },
                      {
                        $eq: [
                          "$toAccount",
                          new mongoose.Types.ObjectId(accountId),
                        ],
                      },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            totalFees: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "fee"] },
                      {
                        $eq: [
                          "$fromAccount",
                          new mongoose.Types.ObjectId(accountId),
                        ],
                      },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
      ]);

      if (summary.length === 0) {
        return {
          totalTransactions: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          totalTransfersOut: 0,
          totalTransfersIn: 0,
          totalInterest: 0,
          totalFees: 0,
          netFlow: 0,
        };
      }

      const result = summary[0];
      result.netFlow =
        result.totalDeposits +
        result.totalTransfersIn +
        result.totalInterest -
        (result.totalWithdrawals + result.totalTransfersOut + result.totalFees);

      delete result._id;
      return result;
    } catch (error) {
      throw error;
    }
  }
}

export default TransactionService;
