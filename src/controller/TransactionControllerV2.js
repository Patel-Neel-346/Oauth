import { ApiError } from "../helpers/ApiError.js";
import { ApiRes } from "../helpers/ApiRespones.js";
import { asyncHandler } from "../helpers/asyncHandler.js";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import TransactionServiceV2 from "../services/TransactionService.js";
import StripeService from "../services/StripeService.js";

const stripeService = new StripeService();

// Traditional Deposit (Cash/Check)
export const DepositFunds = asyncHandler(async (req, res, next) => {
  const { accountNumber, amount, description } = req.body;
  const userId = req.user;

  try {
    const account = await Account.findOne({ accountNumber: accountNumber });

    if (!account) {
      return next(new ApiError(404, "Account not Found"));
    }

    const result = await TransactionServiceV2.DepositFunds(
      account._id.toString(),
      parseFloat(amount),
      description || "Cash Deposit",
      {
        initiateBy: userId,
      }
    );

    return res
      .status(200)
      .json(new ApiRes(200, result, "Deposit Completed Successfully"));
  } catch (error) {
    console.log("Deposit Error:", error);
    return next(new ApiError(500, `Deposit Error: ${error.message}`));
  }
});

// NEW: Stripe Deposit Funds
export const StripeDepositFunds = asyncHandler(async (req, res, next) => {
  const {
    accountNumber,
    amount,
    description,
    paymentMethodId,
    customerData,
    currency = "usd",
  } = req.body;
  const userId = req.user;

  try {
    const account = await Account.findOne({ accountNumber });

    if (!account) {
      return next(new ApiError(404, "Account not found"));
    }

    if (account.userId.toString() !== userId.toString()) {
      return next(new ApiError(403, "Unauthorized access to account"));
    }

    const paymentData = {
      amount: parseFloat(amount),
      currency,
      accountId: account._id.toString(),
      userId,
      description: description || "Bank Deposit via Stripe",
      paymentMethodId,
      customerData,
      metadata: {
        deposit_type: "stripe",
        account_number: accountNumber,
      },
    };

    const result = await stripeService.handlePayment(paymentData, "process");

    return res
      .status(200)
      .json(new ApiRes(200, result, "Stripe deposit processed successfully"));
  } catch (error) {
    console.log("Stripe Deposit Error:", error);
    return next(new ApiError(500, `Stripe Deposit Error: ${error.message}`));
  }
});

// NEW: Create Stripe Payment Intent
export const StripePaymentIntent = asyncHandler(async (req, res, next) => {
  const {
    accountNumber,
    amount,
    description,
    paymentMethodId,
    customerData,
    currency = "usd",
    action = "create",
  } = req.body;
  const userId = req.user;

  try {
    const account = await Account.findOne({ accountNumber });

    if (!account) {
      return next(new ApiError(404, "Account not found"));
    }

    if (account.userId.toString() !== userId.toString()) {
      return next(new ApiError(403, "Unauthorized access to account"));
    }

    const paymentData = {
      amount: parseFloat(amount),
      currency,
      accountId: account._id.toString(),
      userId,
      description: description || "Bank Deposit via Stripe",
      paymentMethodId,
      customerData,
      metadata: {
        deposit_type: "stripe",
        account_number: accountNumber,
      },
    };

    const result = await stripeService.handlePayment(paymentData, action);
    console.log(result);
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          result,
          action === "create"
            ? "Payment intent created successfully"
            : "Payment processed successfully"
        )
      );
  } catch (error) {
    console.log("Stripe Payment Intent Error:", error);
    return next(new ApiError(500, `Payment Intent Error: ${error.message}`));
  }
});

// NEW: Confirm Stripe Payment
export const ConfirmStripePayment = asyncHandler(async (req, res, next) => {
  const { paymentIntentId, accountNumber } = req.body;

  try {
    const paymentIntent = await stripeService.stripe.paymentIntents.retrieve(
      paymentIntentId
    );

    const account = await Account.findOne({ accountNumber: accountNumber });
    console.log(account);

    if (!account) {
      throw new ApiError(404, "Account not found");
    }

    if (account.status !== "active") {
      throw new ApiError(
        400,
        `Cannot process payment for ${account.status} account`
      );
      0;
    }

    const transaction = await Transaction.findOne({
      "metadata.stripe_payment_intent_id": paymentIntent.id,
    });

    if (paymentIntent.status == "succeeded") {
      transaction.status = "completed";
      account.balance += paymentIntent.amount;
      await account.save();
      await transaction.save();
    }

    return res
      .status(200)
      .json(
        new ApiRes(200, { paymentIntent }, "Payment confirmed successfully")
      );
  } catch (error) {
    console.log("Confirm Payment Error:", error);
    return next(new ApiError(500, `Confirm Payment Error: ${error.message}`));
  }
});

// NEW: Stripe Refund
export const StripeRefund = asyncHandler(async (req, res, next) => {
  const { paymentIntentId, amount, reason } = req.body;

  try {
    const result = await stripeService.refundPayment(
      paymentIntentId,
      amount,
      reason
    );

    return res
      .status(200)
      .json(new ApiRes(200, result, "Refund processed successfully"));
  } catch (error) {
    console.log("Refund Error:", error);
    return next(new ApiError(500, `Refund Error: ${error.message}`));
  }
});

// NEW: Get Stripe Transaction History
export const GetStripeTransactionHistory = asyncHandler(
  async (req, res, next) => {
    const { accountNumber } = req.query;
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user;

    try {
      let accountQuery = { userId };
      if (accountNumber) {
        accountQuery.accountNumber = accountNumber;
      }

      const accounts = await Account.find(accountQuery);
      if (accounts.length === 0) {
        return next(new ApiError(404, "No accounts found"));
      }

      const accountIds = accounts.map((acc) => acc._id);

      const stripeTransactions = await Transaction.find({
        $or: [
          { fromAccount: { $in: accountIds } },
          { toAccount: { $in: accountIds } },
        ],
        reference: { $regex: /^STRIPE_/ },
      })
        .populate("fromAccount", "accountNumber accountType")
        .populate("toAccount", "accountNumber accountType")
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Transaction.countDocuments({
        $or: [
          { fromAccount: { $in: accountIds } },
          { toAccount: { $in: accountIds } },
        ],
        reference: { $regex: /^STRIPE_/ },
      });

      return res.status(200).json(
        new ApiRes(
          200,
          {
            transactions: stripeTransactions,
            pagination: {
              currentPage: parseInt(page),
              totalPages: Math.ceil(total / limit),
              totalTransactions: total,
              hasNext: page * limit < total,
              hasPrev: page > 1,
            },
          },
          "Stripe transaction history retrieved successfully"
        )
      );
    } catch (error) {
      console.log("Stripe Transaction History Error:", error);
      return next(new ApiError(500, `Stripe History Error: ${error.message}`));
    }
  }
);

export const HandleStripePayment = asyncHandler(async (req, res, next) => {
  const {
    accountNumber,
    amount,
    description,
    paymentMethodId,
    customerData,
    currency = "usd",
    action = "create", // either "create" or "process"
  } = req.body;
  const userId = req.user;

  try {
    const account = await Account.findOne({ accountNumber });

    if (!account) {
      return next(new ApiError(404, "Account not found"));
    }

    if (account.userId.toString() !== userId.toString()) {
      return next(new ApiError(403, "Unauthorized access to account"));
    }

    const paymentData = {
      amount: parseFloat(amount),
      currency,
      accountId: account._id.toString(),
      userId,
      description: description || "Bank Deposit via Stripe",
      paymentMethodId,
      customerData,
      metadata: {
        deposit_type: "stripe",
        account_number: accountNumber,
      },
    };

    const result = await stripeService.handlePayment(paymentData, action);

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          result,
          action === "create"
            ? "Payment intent created successfully"
            : "Payment processed successfully"
        )
      );
  } catch (error) {
    console.log("Stripe Payment Error:", error);
    return next(new ApiError(500, `Stripe Payment Error: ${error.message}`));
  }
});

// Add Payment Method
export const AddPaymentMethod = asyncHandler(async (req, res, next) => {
  const { cardData, customerId } = req.body;

  try {
    const result = await stripeService.createPaymentMethod(
      cardData,
      customerId
    );

    return res
      .status(200)
      .json(new ApiRes(200, result, "Payment method added successfully"));
  } catch (error) {
    console.log("Payment Method Error:", error);
    return next(new ApiError(500, `Payment Method Error: ${error.message}`));
  }
});

// Get User Payment Methods
export const GetPaymentMethods = asyncHandler(async (req, res, next) => {
  const { customerId } = req.params;

  try {
    const result = await stripeService.getUserPaymentMethods(customerId);

    return res
      .status(200)
      .json(new ApiRes(200, result, "Payment methods retrieved successfully"));
  } catch (error) {
    console.log("Get Payment Methods Error:", error);
    return next(new ApiError(500, `Payment Methods Error: ${error.message}`));
  }
});

// Withdraw Funds
export const WithDrawFunds = asyncHandler(async (req, res, next) => {
  const { accountNumber, amount, description } = req.body;
  const userId = req.user;

  try {
    const account = await Account.findOne({ accountNumber });
    if (!account) {
      return next(new ApiError(404, "Account not found"));
    }

    const result = await TransactionServiceV2.WithdrawFunds(
      account._id.toString(),
      parseFloat(amount),
      description || "Withdrawal",
      {
        initiateBy: userId,
      }
    );

    return res
      .status(200)
      .json(new ApiRes(200, result, "Withdrawal completed successfully"));
  } catch (error) {
    console.log("Withdrawal Error:", error);
    return next(new ApiError(500, `Withdrawal Error: ${error.message}`));
  }
});

// Transfer Funds
export const TransferFunds = asyncHandler(async (req, res, next) => {
  const { fromAccountNumber, toAccountNumber, amount, description } = req.body;
  const userId = req.user;

  try {
    const fromAccount = await Account.findOne({
      accountNumber: fromAccountNumber,
    });

    if (!fromAccount) {
      return next(new ApiError(404, "Source account not found"));
    }

    const toAccount = await Account.findOne({
      accountNumber: toAccountNumber,
    });

    if (!toAccount) {
      return next(new ApiError(404, "Destination account not found"));
    }

    if (fromAccount._id.toString() === toAccount._id.toString()) {
      return next(
        new ApiError(400, "Cannot transfer money to the same account")
      );
    }

    const result = await TransactionServiceV2.TransferFunds(
      fromAccount._id.toString(),
      toAccount._id.toString(),
      parseFloat(amount),
      description || "Transfer",
      {
        initiatedBy: userId,
      }
    );

    res
      .status(200)
      .json(new ApiRes(200, result, "Transfer completed successfully"));
  } catch (error) {
    console.log(`Transfer Error: ${error}`);
    return next(new ApiError(500, `Transfer Error: ${error.message}`));
  }
});

export const StripeTransferFunds = asyncHandler(async (req, res, next) => {
  const {
    fromAccountNumber,
    toAccountNumber,
    amount,
    description,
    paymentMethodId, // For funding the transfer if source account has insufficient balance
    customerData,
    currency = "usd",
    transferType = "instant", // instant, standard
  } = req.body;
  const userId = req.user;

  try {
    // Validate input
    if (!fromAccountNumber || !toAccountNumber || !amount || amount <= 0) {
      return next(
        new ApiError(400, "Missing required fields or invalid amount")
      );
    }

    if (fromAccountNumber === toAccountNumber) {
      return next(new ApiError(400, "Cannot transfer to the same account"));
    }

    // Find accounts
    const [fromAccount, toAccount] = await Promise.all([
      Account.findOne({ accountNumber: fromAccountNumber }),
      Account.findOne({ accountNumber: toAccountNumber }),
    ]);

    if (!fromAccount) {
      return next(new ApiError(404, "Source account not found"));
    }

    if (!toAccount) {
      return next(new ApiError(404, "Destination account not found"));
    }

    // Authorization check
    if (fromAccount.userId.toString() !== userId.toString()) {
      return next(new ApiError(403, "Unauthorized access to source account"));
    }

    const transferData = {
      fromAccount,
      toAccount,
      amount: parseFloat(amount),
      currency,
      userId,
      description: description || "Stripe Transfer",
      paymentMethodId,
      customerData,
      transferType,
      metadata: {
        transfer_type: "stripe",
        from_account_number: fromAccountNumber,
        to_account_number: toAccountNumber,
      },
    };

    const result = await stripeService.handleTransfer(transferData);

    return res
      .status(200)
      .json(new ApiRes(200, result, "Transfer processed successfully"));
  } catch (error) {
    console.log("Stripe Transfer Error:", error);
    return next(new ApiError(500, `Transfer Error: ${error.message}`));
  }
});

export const GetAccountBalance = asyncHandler(async (req, res, next) => {
  const { accountNumber } = req.body;
  const { limit = 10 } = req.params || req.query;
  const userId = req.user;
  // console.log(req.body.accountNumber);
  // console.log("THis is Calling");
  // console.log(accountNumber);
  try {
    const account = await Account.findOne({
      accountNumber: accountNumber,
      userId,
    });

    if (!account) {
      return next(new ApiError(404, "Account not found"));
    }

    const result = await TransactionServiceV2.GetAccountBalance(
      account._id.toString(),
      parseInt(limit)
    );

    res
      .status(200)
      .json(new ApiRes(200, result, "Account balance retrieved successfully"));
  } catch (error) {
    console.log(`Account Balance Error: ${error.message}`);
    return next(new ApiError(500, `Balance Error: ${error.message}`));
  }
});

// Get Transaction History
export const GetTransactionHistory = asyncHandler(async (req, res, next) => {
  const { accountNumber } = req.params;

  const {
    type,
    status,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    page = 1,
    limit = 10,
  } = req.query;

  const userId = req.user;

  try {
    const account = await Account.findOne({
      accountNumber: accountNumber,
    });

    if (!account) {
      return next(new ApiError(400, "Account does not exist"));
    }

    const filter = {
      type,
      status,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
    };

    // Remove undefined values from filter
    Object.keys(filter).forEach((key) => {
      if (filter[key] === undefined) {
        delete filter[key];
      }
    });

    const result = await TransactionServiceV2.GetTransactionHistoryFromServices(
      account._id.toString(),
      filter,
      page,
      limit
    );

    return res
      .status(200)
      .json(
        new ApiRes(200, result, "Transaction history retrieved successfully")
      );
  } catch (error) {
    console.log("Transaction history error in controller");
    return next(new ApiError(500, `Transaction Error: ${error.message}`));
  }
});

// Transaction Summary
export const TransactionSummary = asyncHandler(async (req, res, next) => {
  const userId = req.user;
  const { period = "month", accountId } = req.query;

  try {
    const accountQuery = { userId };
    if (accountId) {
      accountQuery._id = accountId;

      const account = await Account.findOne(accountQuery);
      if (!account) {
        return next(new ApiError(404, "Account not found"));
      }
    }

    const userAccounts = await Account.find(accountQuery).select("_id");
    const accountIds = userAccounts.map((acc) => acc._id);

    if (accountIds.length === 0) {
      return res
        .status(200)
        .json(
          new ApiRes(200, { statistics: {} }, "No accounts found for user")
        );
    }

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

    const dailyStats = await Transaction.aggregate([
      {
        $match: {
          $or: [
            { fromAccount: { $in: accountIds } },
            { toAccount: { $in: accountIds } },
          ],
          createdAt: { $gte: startDate },
          status: "completed",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json(
      new ApiRes(
        200,
        {
          period,
          startDate,
          endDate: now,
          statistics: formattedStats,
          dailyBreakdown: dailyStats,
          totalAccounts: accountIds.length,
        },
        "Transaction statistics retrieved successfully"
      )
    );
  } catch (error) {
    console.log("TransactionSummary Error");
    return next(
      new ApiError(500, `Transaction Summary Error: ${error.message}`)
    );
  }
});
