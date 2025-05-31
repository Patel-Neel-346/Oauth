import mongoose from "mongoose";
import { ApiError } from "../helpers/ApiError.js";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";

class TransactionServiceV2 {
  //helper mathods

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

  //calculate fee
  static calculateTransferFee(fromAccount, toAccount, amount) {
    if (fromAccount.userId.toString() === toAccount.userId.toString()) {
      return 0;
    }

    const baseFee = 2;
    const percentageFee = 0.001;

    let fee = baseFee + amount * percentageFee;

    fee = Math.min(fee, 50);

    fee = Math.max(fee, 1);

    return parseFloat(fee.toFixed(2));
  }

  static async DepositFunds(
    accountId,
    amount,
    description = "Deposit",
    metadata = {}
  ) {
    try {
      if (amount <= 0) {
        throw new ApiError(
          400,
          "Deposit amount must be Greather Than Zero 0 :)"
        );
      }
      // console.log("AccountId:", accountId);
      const account = await Account.findById(accountId);
      // console.log(account);
      if (!account) {
        throw new ApiError(400, "Account Not Found");
      }

      if (account.status != "active") {
        throw new ApiError(
          400,
          `Can't deposit Amount to ${account.status} Account`
        );
      }

      const transaction = new Transaction({
        toAccount: accountId,
        amount,
        type: "deposit",
        description,
        status: "pending",
        reference: `DEPOSIT ${Date.now()}${Math.floor(Math.random() * 1000)}`,
        metadata,
      });
      await transaction.save();

      account.balance += amount;
      await account.save();

      transaction.status = "completed";
      transaction.processAt = new Date();
      await transaction.save();

      //return respone
      return {
        transaction,
        account: {
          accountNumber: account.accountNumber,
          newBalance: account.balance,
          currency: account.currency,
        },
      };
    } catch (error) {
      // console.log("Got error at Transaction Deposit Service");
      throw error;
    }
  }

  static async WithdrawFunds(
    accountId,
    amount,
    description = "Withdraw",
    metadata = {}
  ) {
    try {
      if (amount <= 0) {
        throw new ApiError(400, "Withdraw amount must be grather than zero 0 ");
      }

      const account = await Account.findById(accountId);
      if (!account) {
        throw new ApiError(404, "Your account not Found :() ");
      }

      if (account.status != "active") {
        throw new ApiError(404, "Pls active you account :-: ");
      }

      if (account.balance <= amount) {
        throw new ApiError(404, "Dont have Engough Balance in Bank Account ");
      }

      const transaction = new Transaction({
        toAccount: accountId,
        amount,
        type: "withdrawal",
        description,
        status: "pending",
        reference: `WITHDRAW ${Date.now()}${Math.floor(Math.random() * 1000)}`,
        metadata,
      });

      await transaction.save();

      account.balance -= amount;
      await account.save();

      transaction.status = "completed";
      transaction.processAt = new Date();
      await transaction.save();

      //return respone
      return {
        transaction,
        account: {
          accountNumber: account.accountNumber,
          newBalance: account.balance,
          currency: account.currency,
        },
      };
    } catch (error) {
      // console.log("WithDraw Error:", error);
      throw error;
    }
  }

  static async TransferFunds(
    fromAccountId,
    toAccountId,
    amount,
    description = "Transfer",
    metadata = {}
  ) {
    try {
      if (amount <= 0) {
        throw new ApiError(
          400,
          "Transfer Amount must be Grether than zero 0 man "
        );
      }

      const [fromAccount, toAccount] = await Promise.all([
        Account.findById(fromAccountId),
        Account.findById(toAccountId),
      ]);

      if (!fromAccount) {
        throw new ApiError(404, "Soruce account not found :(");
      }

      if (!toAccount) {
        throw new ApiError(404, "Destination Account not found :(");
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

      if (fromAccount.currency !== toAccount.currency) {
        throw new ApiError(
          400,
          "Currency Mismatch between Two Account ,Currency must be same in both Account :("
        );
      }

      if (fromAccount.balance < amount) {
        throw new ApiError(
          400,
          "Bro you have not enough money to tranfer man "
        );
      }

      const minBalance = this.getMinimumBalance(fromAccount.accountType);

      if (fromAccount.balance - amount < minBalance) {
        throw new ApiError(
          400,
          `Transfer would breach minimum balance requirement of ${fromAccount.currency}${minBalance}`
        );
      }

      const tranferFee = this.calculateTransferFee(
        fromAccount,
        toAccount,
        amount
      );
      // console.log(tranferFee);

      const totalDeduction = amount + tranferFee;

      if (fromAccount.balance < totalDeduction) {
        throw new ApiError(400, "Dont have Enough Money In Account :_:");
      }

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
          tranferFee,
          totalDeduction,
        },
      });

      await transaction.save();

      fromAccount.balance -= totalDeduction;
      toAccount.balance += amount;

      await Promise.all([fromAccount.save(), toAccount.save()]);

      //if transfer fee have
      if (tranferFee > 0) {
        //make transaction for fee
        const feeTransaction = new Transaction({
          fromAccount: fromAccountId,
          amount: tranferFee,
          type: "fee",
          description: "Transfer Fee",
          status: "completed",
          reference: `FEE${Date.now()}${Math.floor(Math.random() * 1000)}`,
          processAt: new Date(),
          metadata: { relatedTransactionID: transaction._id },
        });

        await feeTransaction.save();
      }

      transaction.status = "completed";
      transaction.processAt = new Date();
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
        tranferFee: tranferFee > 0 ? tranferFee : null,
      };
    } catch (error) {
      // console.log(`Transfer Money Error in Service`);
      throw error;
    }
  }

  static async GetAccountBalance(accountId, limit = 10) {
    try {
      const account = await Account.findById(accountId);

      if (!account) {
        throw new ApiError(404, "Account does not exits in Our bank ");
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
      // console.log(`get Account error in Services`);
      throw error;
    }
  }

  static async GetTransactionHistoryFromServices(
    accountId,
    filters = {},
    page = 1,
    limit = 10
  ) {
    try {
      const account = await Account.findById(accountId);
      if (!account) {
        throw new ApiError(404, "Account not found :()");
      }

      //build query where we can store everything
      const query = {
        $or: [{ fromAccount: accountId }, { toAccount: accountId }],
      };

      if (filters.type) query.type = filters.type;
      if (filters.status) query.status = filters.status;

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateFrom);
      }

      if (filters.amountMin || filters.amountMax) {
        query.amount = {};
        if (filters.amountMin)
          query.amount.$gte = parseFloat(filters.amountMin);
        if (filters.amountMax)
          query.amount.$lte = parseFloat(filters.amountMax);
      }

      // console.log(query);

      //cal pagination bro ;-;

      const skip = (page - 1) * limit;

      const [transaction, totalCountDocument] = await Promise.all([
        Transaction.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("fromAccount", "accountNumber accountType")
          .populate("toAccount", "accountNumber accountTye"),
        Transaction.countDocuments(query),
      ]);

      //calcu summary that i will do it later man first i finished This Service then i do it
      //now i am doint it
      const summary = await this.CalculateTransactionSummary(
        accountId,
        filters
      );

      return {
        transaction,
        pagination: {
          currentPages: page,
          totalPages: Math.ceil(totalCountDocument / limit),
          totalTransaction: totalCountDocument,
          hasNextPage: page < Math.ceil(totalCountDocument / limit),
          hasPrevPage: page > 1,
        },
        summary,
      };
    } catch (error) {
      // console.log("getHistroy Error in Services ");
      throw error;
    }
  }

  static async CalculateTransactionSummary(accountId, filters = {}) {
    try {
      const query = {
        $or: [{ fromAccount: accountId }, { toAccount: accountId }],
      };

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
        //match query Data
        {
          $match: query,
        },

        //grouping data
        {
          $group: {
            _id: null,
            totalTransaction: { $sum: 1 },
            totalDeposits: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["type", "deposit"] },
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
            totalWithDreawls: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["type", "withdrawal"] },
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
            totalTransferOut: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["type", "transfer"] },
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
            totalTransferIn: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["type", "transfer"] },
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
                      { $eq: ["type", "fee"] },
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
          totalFees: 0,
        };
      }

      const result = summary[0];

      return result;
    } catch (error) {
      // console.log("Summary Error in services");
      throw error;
    }
  }
}

export default TransactionServiceV2;
