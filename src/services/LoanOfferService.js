import User from "../models/User.js";
import { ApiError } from "../helpers/ApiError.js";
import Role from "../models/Role.js";
import LenderProfile from "../models/LenderProfile.js";
import LoanOffer from "../models/Loan/LoanOffer.js";
class LoanOfferService {
  static async createLoanOfferService(req) {
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

    const user = await User.findById(req.user);
    if (!user) throw new ApiError(404, "User not Found :-:");

    const lenderRole = await Role.findOne({ name: "lender", users: user._id });
    if (!lenderRole)
      throw new ApiError(404, "Lender role not assigned to User :-;");

    const lenderProfile = await LenderProfile.findOne({
      roleId: lenderRole._id,
    });
    if (!lenderProfile) throw new ApiError(404, "Lender Profile Not Found -;");

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
    lenderProfile.availableFunds -= totalOffered;
    await lenderProfile.save();

    return loanOffer;
  }

  static async getAllLoanOffersService(queryParams) {
    const {
      minAmount,
      maxAmount,
      maxInterestRate,
      purpose,
      term,
      page = 1,
      limit = 10,
    } = queryParams;

    let query = { status: "active" };

    if (minAmount) query.minAmount = { $gte: minAmount };
    if (maxAmount) query.maxAmount = { $lte: maxAmount };
    if (maxInterestRate) query.interestRate = { $lte: maxInterestRate };
    if (purpose) query.loanPurpose = { $in: [purpose] };
    if (term) query.termOptions = { $in: [parseInt(term)] };

    const offers = await LoanOffer.find(query)
      .populate("lenderId", "firstName lastName email profileImage")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    console.log(offers);
    const total = await LoanOffer.countDocuments(query);

    return {
      offers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async getLoanOfferDetailsService(offerId) {
    const offer = await LoanOffer.findById(offerId)
      .populate("lenderId", "firstName lastName email profileImage")
      .populate({
        path: "applications",
        populate: { path: "borrowerId", select: "firstName lastName" },
      });

    if (!offer) throw new ApiError(400, "Loan Offer Not Found Man :(");
    return offer;
  }

  static async updateLoanOfferService(offerId, userId, updateData) {
    const offer = await LoanOffer.findOne({ _id: offerId, lenderId: userId });

    if (!offer) throw new ApiError(400, "Loan offer not Found -_-");

    Object.assign(offer, updateData);
    await offer.save();

    return offer;
  }

  static async getLenderOfferSerivces(userId, queryParams) {
    const { status, page = 1, limit = 10 } = queryParams;

    let query = { lenderId: userId };

    if (status) query.status = status;
    console.log(query);
    const offer = await LoanOffer.find(query)
      .populate("applications")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await LoanOffer.countDocuments();

    return {
      offer,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export default LoanOfferService;
