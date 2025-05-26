import P2PLoan from "../../models/Loan/P2PLoan.js";
import LoanApplication from "../../models/Loan/LoanApplication.js";
import User from "../../models/User.js";
import Account from "../../models/Account.js";
import Transaction from "../../models/Transaction.js";

class P2PLoanController {
  // Disburse loan after approval (ADMIN only)
  static async disburseLoan(req, res) {
    try {
      const { applicationId, borrowerAccountId } = req.body;

      const application = await LoanApplication.findOne({
        applicationId,
        status: "approved",
      })
        .populate("loanOfferId")
        .populate("borrowerId")
        .populate("lenderId");

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Approved application not found",
        });
      }

      // Verify accounts
      const borrowerAccount = await Account.findOne({
        accountId: borrowerAccountId,
        userId: application.borrowerId._id,
        status: "ACTIVE",
      });

      const lenderAccount = await Account.findOne({
        userId: application.lenderId._id,
        status: "ACTIVE",
      });

      if (!borrowerAccount || !lenderAccount) {
        return res.status(404).json({
          success: false,
          message: "Valid accounts not found",
        });
      }

      // Check lender has sufficient balance
      if (lenderAccount.balance < application.requestedAmount) {
        return res.status(400).json({
          success: false,
          message: "Insufficient balance in lender account",
        });
      }

      // Create P2P loan record
      const p2pLoan = new P2PLoan({
        applicationId: application.applicationId,
        loanOfferId: application.loanOfferId._id,
        borrowerId: application.borrowerId._id,
        lenderId: application.lenderId._id,
        principalAmount: application.requestedAmount,
        interestRate: application.interestRate,
        termInMonths: application.selectedTerm,
        monthlyEMI: application.calculatedEMI,
        totalPayableAmount: application.totalPayableAmount,
        purpose: application.purpose,
      });

      await p2pLoan.save();

      // Transfer funds from lender to borrower
      lenderAccount.balance -= application.requestedAmount;
      borrowerAccount.balance += application.requestedAmount;

      await lenderAccount.save();
      await borrowerAccount.save();

      // Create transaction records
      const lenderTransaction = new Transaction({
        userId: application.lenderId._id,
        accountId: lenderAccount.accountId,
        type: "DEBIT",
        amount: application.requestedAmount,
        description: `Loan disbursed to ${application.borrowerId.firstName} ${application.borrowerId.lastName}`,
        category: "LOAN_DISBURSEMENT",
        referenceId: p2pLoan.loanId,
        balanceAfter: lenderAccount.balance,
      });

      const borrowerTransaction = new Transaction({
        userId: application.borrowerId._id,
        accountId: borrowerAccount.accountId,
        type: "CREDIT",
        amount: application.requestedAmount,
        description: `Loan received from ${application.lenderId.firstName} ${application.lenderId.lastName}`,
        category: "LOAN_RECEIVED",
        referenceId: p2pLoan.loanId,
        balanceAfter: borrowerAccount.balance,
      });

      await lenderTransaction.save();
      await borrowerTransaction.save();

      res.status(201).json({
        success: true,
        message: "Loan disbursed successfully",
        data: {
          loanId: p2pLoan.loanId,
          principalAmount: p2pLoan.principalAmount,
          monthlyEMI: p2pLoan.monthlyEMI,
          nextPaymentDate: p2pLoan.nextPaymentDate,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error disbursing loan",
        error: error.message,
      });
    }
  }

  // Make loan payment (BORROWER only)
  static async makeLoanPayment(req, res) {
    try {
      const { loanId } = req.params;
      const { paymentAmount, accountId } = req.body;

      const loan = await P2PLoan.findOne({
        loanId,
        borrowerId: req.user.id,
        status: "active",
      }).populate("lenderId");

      if (!loan) {
        return res.status(404).json({
          success: false,
          message: "Active loan not found",
        });
      }

      // Verify borrower account
      const borrowerAccount = await Account.findOne({
        accountId,
        userId: req.user.id,
        status: "ACTIVE",
      });

      if (!borrowerAccount || borrowerAccount.balance < paymentAmount) {
        return res.status(400).json({
          success: false,
          message: "Insufficient balance or invalid account",
        });
      }

      // Get lender account
      const lenderAccount = await Account.findOne({
        userId: loan.lenderId._id,
        status: "ACTIVE",
      });

      if (!lenderAccount) {
        return res.status(404).json({
          success: false,
          message: "Lender account not found",
        });
      }

      // Calculate interest and principal components
      const monthlyInterestRate = loan.interestRate / 100 / 12;
      const interestAmount = loan.remainingBalance * monthlyInterestRate;
      const principalAmount = Math.min(
        paymentAmount - interestAmount,
        loan.remainingBalance
      );

      // Update loan details
      loan.remainingBalance -= principalAmount;
      loan.paymentsCompleted += 1;
      loan.lastPaymentDate = new Date();

      // Calculate next payment date (30 days from now)
      if (loan.remainingBalance > 0) {
        loan.nextPaymentDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else {
        loan.status = "completed";
        loan.nextPaymentDate = null;
      }

      // Add payment to history
      const paymentRecord = {
        paymentId: `PAY${Date.now()}${Math.random()
          .toString(36)
          .substr(2, 4)
          .toUpperCase()}`,
        amount: paymentAmount,
        principalPaid: principalAmount,
        interestPaid: interestAmount,
        remainingBalance: loan.remainingBalance,
        paymentDate: new Date(),
        status: "paid",
      };

      loan.paymentHistory.push(paymentRecord);

      // Transfer funds
      borrowerAccount.balance -= paymentAmount;
      lenderAccount.balance += paymentAmount;

      await loan.save();
      await borrowerAccount.save();
      await lenderAccount.save();

      // Create transaction records
      const borrowerTransaction = new Transaction({
        userId: req.user.id,
        accountId: borrowerAccount.accountId,
        type: "DEBIT",
        amount: paymentAmount,
        description: `Loan payment for ${loanId}`,
        category: "LOAN_PAYMENT",
        referenceId: loan.loanId,
        balanceAfter: borrowerAccount.balance,
      });

      const lenderTransaction = new Transaction({
        userId: loan.lenderId._id,
        accountId: lenderAccount.accountId,
        type: "CREDIT",
        amount: paymentAmount,
        description: `Loan payment received for ${loanId}`,
        category: "LOAN_PAYMENT_RECEIVED",
        referenceId: loan.loanId,
        balanceAfter: lenderAccount.balance,
      });

      await borrowerTransaction.save();
      await lenderTransaction.save();

      res.json({
        success: true,
        message: "Payment made successfully",
        data: {
          paymentId: paymentRecord.paymentId,
          remainingBalance: loan.remainingBalance,
          nextPaymentDate: loan.nextPaymentDate,
          loanStatus: loan.status,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error processing payment",
        error: error.message,
      });
    }
  }

  // Get loan details
  static async getLoanDetails(req, res) {
    try {
      const { loanId } = req.params;

      const loan = await P2PLoan.findOne({ loanId })
        .populate("borrowerId", "firstName lastName email")
        .populate("lenderId", "firstName lastName email");

      if (!loan) {
        return res.status(404).json({
          success: false,
          message: "Loan not found",
        });
      }

      // Check if user has permission to view this loan
      const user = await User.findById(req.user.id);
      const canView =
        loan.borrowerId._id.equals(req.user.id) ||
        loan.lenderId._id.equals(req.user.id) ||
        user.roles.includes("ADMIN");

      if (!canView) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      res.json({
        success: true,
        data: loan,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching loan details",
        error: error.message,
      });
    }
  }

  // Get user's loans (borrower/lender)
  static async getUserLoans(req, res) {
    try {
      const { type, status, page = 1, limit = 10 } = req.query;
      let query = {};

      if (type === "borrowed") {
        query.borrowerId = req.user.id;
      } else if (type === "lent") {
        query.lenderId = req.user.id;
      } else {
        // Show both borrowed and lent loans
        query.$or = [{ borrowerId: req.user.id }, { lenderId: req.user.id }];
      }

      if (status) query.status = status;

      const loans = await P2PLoan.find(query)
        .populate("borrowerId", "firstName lastName email")
        .populate("lenderId", "firstName lastName email")
        .sort({ disbursementDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await P2PLoan.countDocuments(query);

      res.json({
        success: true,
        data: {
          loans,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching loans",
        error: error.message,
      });
    }
  }

  // Get loan payment schedule
  static async getLoanPaymentSchedule(req, res) {
    try {
      const { loanId } = req.params;

      const loan = await P2PLoan.findOne({ loanId });

      if (!loan) {
        return res.status(404).json({
          success: false,
          message: "Loan not found",
        });
      }

      // Check permissions
      const user = await User.findById(req.user.id);
      const canView =
        loan.borrowerId.equals(req.user.id) ||
        loan.lenderId.equals(req.user.id) ||
        user.roles.includes("ADMIN");

      if (!canView) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Generate payment schedule
      const schedule = [];
      const monthlyInterestRate = loan.interestRate / 100 / 12;
      let remainingBalance = loan.principalAmount;
      let paymentDate = new Date(loan.disbursementDate);

      for (let i = 1; i <= loan.termInMonths; i++) {
        paymentDate = new Date(
          paymentDate.getTime() + 30 * 24 * 60 * 60 * 1000
        );

        const interestAmount = remainingBalance * monthlyInterestRate;
        const principalAmount = loan.monthlyEMI - interestAmount;
        remainingBalance -= principalAmount;

        // Check if payment was made
        const paymentMade = loan.paymentHistory.find(
          (p) =>
            p.paymentDate.getMonth() === paymentDate.getMonth() &&
            p.paymentDate.getFullYear() === paymentDate.getFullYear()
        );

        schedule.push({
          installmentNumber: i,
          dueDate: paymentDate,
          emiAmount: loan.monthlyEMI,
          principalAmount: Math.round(principalAmount * 100) / 100,
          interestAmount: Math.round(interestAmount * 100) / 100,
          remainingBalance: Math.max(
            0,
            Math.round(remainingBalance * 100) / 100
          ),
          status: paymentMade
            ? "paid"
            : paymentDate < new Date()
            ? "overdue"
            : "pending",
          paymentDate: paymentMade ? paymentMade.paymentDate : null,
        });
      }

      res.json({
        success: true,
        data: {
          loanId: loan.loanId,
          totalEMI: loan.monthlyEMI,
          totalPayments: loan.termInMonths,
          paymentsCompleted: loan.paymentsCompleted,
          schedule,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error generating payment schedule",
        error: error.message,
      });
    }
  }

  // Get overdue loans (ADMIN)
  static async getOverdueLoans(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const overdueLoans = await P2PLoan.find({
        status: "active",
        nextPaymentDate: { $lt: new Date() },
      })
        .populate("borrowerId", "firstName lastName email phone")
        .populate("lenderId", "firstName lastName email")
        .sort({ nextPaymentDate: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Calculate overdue days for each loan
      const loansWithOverdueDays = overdueLoans.map((loan) => {
        const overdueDays = Math.floor(
          (new Date() - loan.nextPaymentDate) / (1000 * 60 * 60 * 24)
        );
        return {
          ...loan.toObject(),
          overdueDays,
        };
      });

      const total = await P2PLoan.countDocuments({
        status: "active",
        nextPaymentDate: { $lt: new Date() },
      });

      res.json({
        success: true,
        data: {
          loans: loansWithOverdueDays,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching overdue loans",
        error: error.message,
      });
    }
  }

  // Loan analytics dashboard
  static async getLoanAnalytics(req, res) {
    try {
      const user = await User.findById(req.user.id);
      let matchQuery = {};

      // Role-based filtering
      if (user.roles.includes("LENDER") && !user.roles.includes("ADMIN")) {
        matchQuery.lenderId = req.user.id;
      } else if (
        user.roles.includes("BORROWER") &&
        !user.roles.includes("ADMIN")
      ) {
        matchQuery.borrowerId = req.user.id;
      }

      const analytics = await P2PLoan.aggregate([
        { $match: matchQuery },
        {
          $facet: {
            totalStats: [
              {
                $group: {
                  _id: null,
                  totalLoans: { $sum: 1 },
                  totalPrincipal: { $sum: "$principalAmount" },
                  totalOutstanding: { $sum: "$remainingBalance" },
                  avgInterestRate: { $avg: "$interestRate" },
                },
              },
            ],
            statusDistribution: [
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                  amount: { $sum: "$principalAmount" },
                },
              },
            ],
            monthlyTrends: [
              {
                $group: {
                  _id: {
                    year: { $year: "$disbursementDate" },
                    month: { $month: "$disbursementDate" },
                  },
                  count: { $sum: 1 },
                  amount: { $sum: "$principalAmount" },
                },
              },
              { $sort: { "_id.year": -1, "_id.month": -1 } },
              { $limit: 12 },
            ],
          },
        },
      ]);

      res.json({
        success: true,
        data: analytics[0],
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching loan analytics",
        error: error.message,
      });
    }
  }
}

export default P2PLoanController;
