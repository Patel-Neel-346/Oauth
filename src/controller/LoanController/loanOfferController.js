import LoanOffer from "../../models/Loan/LoanOffer.js";
import User from "../../models/User.js";
import LenderProfile from "../../models/LenderProfile.js";
import Role from "../../models/Role.js";

class LoanOfferController {
  // Create loan offer (LENDER only)
  //   static async createLoanOffer(req, res) {
  //     try {
  //       const {
  //         title,
  //         description,
  //         minAmount,
  //         maxAmount,
  //         interestRate,
  //         termOptions,
  //         loanPurpose,
  //         eligibilityCriteria,
  //         totalOffered,
  //         autoApproval,
  //         expiryDate,
  //       } = req.body;

  //       console.log("UserID", req.user);
  //       // Verify lender profile and available funds
  //       const lender = await User.findById(req.user);
  //       console.log(lender);

  //       const lender1 = await Role.findOne({ users: lender._id }).limit(1);
  //       console.log(lender1);
  //       const lenderProfile = await LenderProfile.findOne({
  //         roleId: lender.roleId,
  //       });

  //       if (!lenderProfile) {
  //         return res.status(400).json({
  //           success: false,
  //           message: "Lender profile not found",
  //         });
  //       }

  //       if (lenderProfile.availableFunds < totalOffered) {
  //         return res.status(400).json({
  //           success: false,
  //           message: "Insufficient available funds",
  //         });
  //       }

  //       const loanOffer = new LoanOffer({
  //         lenderId: req.user.id,
  //         title,
  //         description,
  //         minAmount,
  //         maxAmount,
  //         interestRate,
  //         termOptions,
  //         loanPurpose,
  //         eligibilityCriteria,
  //         totalOffered,
  //         availableFunds: totalOffered,
  //         autoApproval,
  //         expiryDate,
  //       });

  //       await loanOffer.save();

  //       // Update lender's available funds
  //       lenderProfile.availableFunds -= totalOffered;
  //       await lenderProfile.save();

  //       res.status(201).json({
  //         success: true,
  //         message: "Loan offer created successfully",
  //         data: loanOffer,
  //       });
  //     } catch (error) {
  //       res.status(500).json({
  //         success: false,
  //         message: "Error creating loan offer",
  //         error: error.message,
  //       });
  //     }
  //   }
  static async createLoanOffer(req, res) {
    try {
      const {
        title,
        description,
        minAmount,
        maxAmount,
        interestRate,
        termOptions,
        loanPurpose,
        eligibilityCriteria,
        totalOffered,
        autoApproval,
        expiryDate,
      } = req.body;

      // Step 1: Find the user
      const user = await User.findById(req.user);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      console.log(user);
      // Step 2: Find lender role that contains this user
      const lenderRole = await Role.findOne({
        name: "lender",
        users: user._id,
      });
      console.log(lenderRole);

      if (!lenderRole) {
        return res.status(400).json({
          success: false,
          message: "Lender role not assigned to user",
        });
      }

      // Step 3: Get lender profile using roleId
      const lenderProfile = await LenderProfile.findOne({
        roleId: lenderRole._id,
      });

      if (!lenderProfile) {
        return res.status(400).json({
          success: false,
          message: "Lender profile not found",
        });
      }

      // Step 4: Check funds
      if (lenderProfile.availableFunds < totalOffered) {
        return res.status(400).json({
          success: false,
          message: "Insufficient available funds",
        });
      }

      // Step 5: Create loan offer
      const loanOffer = new LoanOffer({
        lenderId: user._id,
        title,
        description,
        minAmount,
        maxAmount,
        interestRate,
        termOptions,
        loanPurpose,
        eligibilityCriteria,
        totalOffered,
        availableFunds: totalOffered,
        autoApproval,
        expiryDate,
      });

      await loanOffer.save();

      // Step 6: Deduct funds from lender profile
      lenderProfile.availableFunds -= totalOffered;
      await lenderProfile.save();

      res.status(201).json({
        success: true,
        message: "Loan offer created successfully",
        data: loanOffer,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error creating loan offer",
        error: error.message,
      });
    }
  }

  // Get all active loan offers
  static async getAllLoanOffers(req, res) {
    try {
      const {
        minAmount,
        maxAmount,
        maxInterestRate,
        purpose,
        term,
        page = 1,
        limit = 10,
      } = req.query;

      let query = { status: "active" };

      // Apply filters
      if (minAmount) query.minAmount = { $lte: minAmount };
      if (maxAmount) query.maxAmount = { $gte: maxAmount };
      if (maxInterestRate) query.interestRate = { $lte: maxInterestRate };
      if (purpose) query.loanPurpose = { $in: [purpose] };
      if (term) query.termOptions = { $in: [parseInt(term)] };

      const offers = await LoanOffer.find(query)
        .populate("lenderId", "firstName lastName email profileImage")
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await LoanOffer.countDocuments(query);

      res.json({
        success: true,
        data: {
          offers,
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
        message: "Error fetching loan offers",
        error: error.message,
      });
    }
  }

  // Get loan offer details
  static async getLoanOfferDetails(req, res) {
    try {
      const { offerId } = req.params;

      const offer = await LoanOffer.findById(offerId)
        .populate("lenderId", "firstName lastName email profileImage")
        .populate({
          path: "applications",
          populate: {
            path: "borrowerId",
            select: "firstName lastName",
          },
        });

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "Loan offer not found",
        });
      }

      res.json({
        success: true,
        data: offer,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching loan offer details",
        error: error.message,
      });
    }
  }

  // Update loan offer (LENDER only)
  static async updateLoanOffer(req, res) {
    try {
      const { offerId } = req.params;
      const updateData = req.body;

      const offer = await LoanOffer.findOne({
        _id: offerId,
        lenderId: req.user.id,
      });

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "Loan offer not found",
        });
      }

      Object.assign(offer, updateData);
      await offer.save();

      res.json({
        success: true,
        message: "Loan offer updated successfully",
        data: offer,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error updating loan offer",
        error: error.message,
      });
    }
  }

  // Get lender's own offers
  static async getLenderOffers(req, res) {
    try {
      const { status, page = 1, limit = 10 } = req.query;

      let query = { lenderId: req.user.id };
      if (status) query.status = status;

      const offers = await LoanOffer.find(query)
        .populate("applications")
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await LoanOffer.countDocuments(query);

      res.json({
        success: true,
        data: {
          offers,
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
        message: "Error fetching lender offers",
        error: error.message,
      });
    }
  }
}

export default LoanOfferController;
