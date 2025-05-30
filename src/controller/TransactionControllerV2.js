import { ApiError } from "../helpers/ApiError.js";
import { ApiRes } from "../helpers/ApiRespones.js";
import { asyncHandler } from "../helpers/asyncHandler.js";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import TransactionServiceV2 from "../services/TransactionService.js";

export const DepositFunds = asyncHandler(async (req, res, next) => {
  const { accountNumber, amount, description } = req.body;

  const userId = req.user;

  try {
    const account = await Account.findOne({ accountNumber: accountNumber });
    console.log(account._id.toString());

    if (!account) {
      return next(new ApiError(404, "Account not Found :("));
    }

    const result = await TransactionServiceV2.DepositFunds(
      account._id.toString(),
      parseFloat(amount),
      description || "Deposit",
      {
        initiateBy: userId,
      }
    );

    // console.log(result);

    return res
      .status(200)
      .json(
        new ApiRes(200, result, "Deposit Completed SuccessFully :) ye ye ye ")
      );
  } catch (error) {
    console.log("Deposit Error:", error);
    return next(new ApiError(500, `Deposit Error:${error.message}`));
  }
});

export const WithDrawFunds = asyncHandler(async (req, res, next) => {
  const { accountNumber, amount, description } = req.body;
  const userId = req.user;

  try {
    const account = await Account.findOne({ accountNumber });
    if (!account) {
      return next(new ApiError(404, "Account not Found in Controller :("));
    }

    const result = await TransactionServiceV2.WithdrawFunds(
      account._id.toString(),
      parseFloat(amount),
      description || "Withdraw",
      {
        initiateBy: userId,
      }
    );

    return res
      .status(200)
      .json(new ApiRes(200, result, "Withdraw Completed SuccessFully :) "));
  } catch (error) {
    console.log("WithDraw Error At WithDraw Controller :(");
    return next(new ApiError(500, `${error.message}`));
  }
});

export const TransferFunds = asyncHandler(async (req, res, next) => {
  const { fromAccountNumber, toAccountNumber, amount, description } = req.body;

  const userId = req.user;

  try {
    const fromAccount = await Account.findOne({
      accountNumber: fromAccountNumber,
    });
    console.log(fromAccount);

    if (!fromAccount) {
      return next(new ApiError(404, "Source account not found man :("));
    }

    const toAccount = await Account.findOne({
      accountNumber: toAccountNumber,
    });
    console.log(toAccount);
    if (!toAccount) {
      return next(new ApiError(404, "Destination account not Found man"));
    }

    if (fromAccount._id.toString() === toAccount._id.toString()) {
      return next(
        new ApiError(
          404,
          "Bro can not tranfer money to Your Same account man :("
        )
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
      .json(
        new ApiRes(
          200,
          result,
          "Transfer Completed Successfully Buddy Enjoy :)"
        )
      );
  } catch (error) {
    console.log(`Transfer Error:${error}`);
    return next(new ApiError(500, "Transfer error controller"));
  }
});

export const GetAccountBalance = asyncHandler(async (req, res, next) => {
  const { accountNumber } = req.params || req.query;
  const { limit = 10 } = req.params || req.query;

  const userId = req.user;
  console.log(userId);
  try {
    const account = await Account.findOne({
      accountNumber: accountNumber,
      userId,
    });
    console.log(account);
    if (!account) {
      return next(new ApiError(404, "Account not found bro :("));
    }

    const result = await TransactionServiceV2.GetAccountBalance(
      account._id.toString(),
      parseInt(limit)
    );

    res
      .status(200)
      .json(new ApiRes(200, result, "Account Balance Retrived SuccessFully"));
  } catch (error) {
    console.log(`Account Balance Error:${error.message}`);
    return next(new ApiError(500, `Balance Error in Account ${error.message}`));
  }
});

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
    console.log(accountNumber);
    const account = await Account.findOne({
      accountNumber: accountNumber,
    });
    console.log(account);
    if (!account) {
      return next(new ApiError(400, "Account does not exisits"));
    }

    //build filter man
    const filter = {
      type,
      status,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
    };

    //remove undefined Values from Filter :-:

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

    console.log(result);

    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          result,
          "SuccessFully Retrived Transaction Histroy Of Your bank account :)"
        )
      );
  } catch (error) {
    console.log("Transaction history error in controller");
    return next(new ApiError(500, `Trasaction Error:${error.message}`));
  }
});

export const TransactionSummary = asyncHandler(async (req, res, next) => {
  const userId = req.user;
  const { period = "month", accountId } = req.query;

  try {
    const accountQuery = { userId };
    if (accountId) {
      accountQuery._id = accountId;

      const account = await Account.findOne(accountQuery);
      if (!account) {
        return next(new ApiError(404, "Account not found  :-]"));
      }
    }

    const userAccounts = await Account.find(accountQuery).select("_id");
    const accountIds = userAccounts.map((acc) => acc._id);

    if (accountIds.length == 0) {
      return res
        .status(200)
        .json(
          new ApiRes(200, { statistics: {} }, "No Accounts Founds For User")
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

    // Aggregate transaction statistics
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

    // Format statistics
    const formattedStats = {};
    statistics.forEach((stat) => {
      formattedStats[stat._id] = {
        count: stat.count,
        totalAmount: parseFloat(stat.totalAmount.toFixed(2)),
        avgAmount: parseFloat(stat.avgAmount.toFixed(2)),
      };
    });

    // Get daily transaction counts for the period
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
      new ApiError(500, `Transaction Summary Error: ${error.message} `)
    );
  }
});
