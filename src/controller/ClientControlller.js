import { ApiError } from "../helpers/ApiError.js";
import { ApiRes } from "../helpers/ApiRespones.js";
import { asyncHandler } from "../helpers/asyncHandler.js";
import Data from "../models/Data.js";

export const getClientData = asyncHandler(async (req, res, next) => {
  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Parse sorting parameters
    const sortBy = req.query.sortBy || "importedAt";
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder;

    // Fetch data with pagination
    const clients = await Data.find({})
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // Get total count for pagination info
    const totalClients = await Data.countDocuments({});
    const totalPages = Math.ceil(totalClients / limit);

    res.status(200).json(
      new ApiRes(
        200,
        {
          clients,
          pagination: {
            totalClients,
            totalPages,
            currentPage: page,
            limit,
          },
        },
        "Clients retrieved successfully"
      )
    );
  } catch (error) {
    console.error("Error fetching clients:", error);
    next(new ApiError(500, "Failed to retrieve clients"));
  }
});

export const getClientDataById = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return next(new ApiError(400, "Invalid client ID format"));
    }

    const client = await Data.findById(id);

    if (!client) {
      return next(new ApiError(404, "Client not found"));
    }

    res
      .status(200)
      .json(new ApiRes(200, { client }, "Client retrieved successfully"));
  } catch (error) {
    console.error(`Error fetching client ${req.params.id}:`, error);
    next(new ApiError(500, "Failed to retrieve client"));
  }
});

export const FilterDataOfClient = asyncHandler(async (req, res, next) => {
  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    //2 50
    //(2-1)*50= 50 // means  first 50 skip then start from 50 to limit 50 means 50 to 100
    //(1-1)*50=0 start 0 to 50

    // Build filter object from request body
    const filterCriteria = {};

    // Process all filter conditions from the request body
    Object.keys(req.body).forEach((key) => {
      const value = req.body[key];

      // Handle numeric ranges
      if (
        typeof value === "object" &&
        (value.min !== undefined || value.max !== undefined)
      ) {
        filterCriteria[key] = {};
        if (value.min !== undefined) filterCriteria[key].$gte = value.min;
        if (value.max !== undefined) filterCriteria[key].$lte = value.max;
      }
      // Handle arrays for OR conditions
      else if (Array.isArray(value) && value.length > 0) {
        filterCriteria[key] = { $in: value };
      }
      // Handle string pattern matching
      else if (typeof value === "string") {
        filterCriteria[key] = { $regex: value, $options: "i" };
      }
      // Handle boolean and exact match conditions
      else {
        filterCriteria[key] = value;
      }
    });

    // console.log("Applied filter criteria:", JSON.stringify(filterCriteria));

    // Fetch filtered data with pagination
    const clients = await Data.find(filterCriteria).skip(skip).limit(limit);

    // Get total matching records for pagination info
    const totalFilteredClients = await Data.countDocuments(filterCriteria);
    const totalPages = Math.ceil(totalFilteredClients / limit);

    res.status(200).json(
      new ApiRes(
        200,
        {
          clients,
          pagination: {
            totalClients: totalFilteredClients,
            totalPages,
            currentPage: page,
            limit,
          },
          filters: req.body,
        },
        "Filtered clients retrieved successfully"
      )
    );
  } catch (error) {
    console.error("Error filtering clients:", error);
    next(new ApiError(500, "Failed to filter clients"));
  }
});

export const GetStatusSummary = asyncHandler(async (req, res, next) => {
  try {
    const results = {};

    // Total count
    results.totalRecords = await Data.countDocuments();

    // Campaign response statistics
    const targetDistribution = await Data.aggregate([
      { $group: { _id: "$Target", count: { $sum: 1 } } },
    ]);

    results.campaignResponse = targetDistribution.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    // Age distribution statistics
    results.ageDistribution = await Data.aggregate([
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lte: ["$age", 20] }, then: "<= 20" },
                { case: { $lte: ["$age", 30] }, then: "21-30" },
                { case: { $lte: ["$age", 40] }, then: "31-40" },
                { case: { $lte: ["$age", 50] }, then: "41-50" },
                { case: { $lte: ["$age", 60] }, then: "51-60" },
              ],
              default: "> 60",
            },
          },
          count: { $sum: 1 },
          yesResponses: {
            $sum: { $cond: [{ $eq: ["$Target", "yes"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Job distribution statistics
    results.jobDistribution = await Data.aggregate([
      {
        $group: {
          _id: "$job",
          count: { $sum: 1 },
          yesCount: { $sum: { $cond: [{ $eq: ["$Target", "yes"] }, 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Housing loan distribution
    results.housingLoanDistribution = await Data.aggregate([
      {
        $group: {
          _id: "$housing",
          count: { $sum: 1 },
          yesCount: { $sum: { $cond: [{ $eq: ["$Target", "yes"] }, 1, 0] } },
        },
      },
    ]);

    // Personal loan distribution
    results.personalLoanDistribution = await Data.aggregate([
      {
        $group: {
          _id: "$loan",
          count: { $sum: 1 },
          yesCount: { $sum: { $cond: [{ $eq: ["$Target", "yes"] }, 1, 0] } },
        },
      },
    ]);

    // Average balance
    const avgBalance = await Data.aggregate([
      { $group: { _id: null, average: { $avg: "$balance" } } },
    ]);
    results.averageBalance = avgBalance.length > 0 ? avgBalance[0].average : 0;

    res
      .status(200)
      .json(
        new ApiRes(
          200,
          { statistics: results },
          "Statistics retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error generating statistics:", error);
    next(new ApiError(500, "Failed to generate statistics"));
  }
});
