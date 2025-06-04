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

// Stripe Deposit - Create Payment Intent
export const CreateStripeDeposit = asyncHandler(async (req, res, next) => {
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

    const result = await stripeService.createPaymentIntent(paymentData);

    return res
      .status(200)
      .json(new ApiRes(200, result, "Payment intent created successfully"));
  } catch (error) {
    console.log("Stripe Deposit Error:", error);
    return next(new ApiError(500, `Stripe Deposit Error: ${error.message}`));
  }
});

// Process Stripe Payment
export const ProcessStripePayment = asyncHandler(async (req, res, next) => {
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

    const result = await stripeService.processPayment(paymentData);

    return res
      .status(200)
      .json(new ApiRes(200, result, "Payment processed successfully"));
  } catch (error) {
    console.log("Stripe Payment Error:", error);
    return next(new ApiError(500, `Payment Error: ${error.message}`));
  }
});

// Stripe Webhook Handler
export const HandleStripeWebhook = asyncHandler(async (req, res, next) => {
  const payload = req.body;
  const signature = req.headers["stripe-signature"];

  try {
    const result = await stripeService.handleWebhook(payload, signature);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.log("Webhook Error:", error);
    return next(new ApiError(400, `Webhook Error: ${error.message}`));
  }
});

// Create/Get Stripe Customer
export const CreateStripeCustomer = asyncHandler(async (req, res, next) => {
  const { email, name, phone } = req.body;
  const userId = req.user;

  try {
    const customer = await stripeService.createOrGetCustomer(
      { email, name, phone },
      userId
    );

    return res
      .status(200)
      .json(
        new ApiRes(200, customer, "Customer created/retrieved successfully")
      );
  } catch (error) {
    console.log("Customer Creation Error:", error);
    return next(new ApiError(500, `Customer Error: ${error.message}`));
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

// Refund Payment
export const RefundPayment = asyncHandler(async (req, res, next) => {
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

// Get Account Balance
export const GetAccountBalance = asyncHandler(async (req, res, next) => {
  const { accountNumber } = req.params || req.query;
  const { limit = 10 } = req.params || req.query;
  const userId = req.user;

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
  const { accountNumber } = req.body || req.params || req.query;
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
