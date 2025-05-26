export const validateLoanOffer = (req, res, next) => {
  const {
    title,
    minAmount,
    maxAmount,
    interestRate,
    termOptions,
    totalOffered,
  } = req.body;

  const errors = [];

  if (!title || title.trim().length === 0) {
    errors.push("Title is required");
  }

  if (!minAmount || minAmount < 1000) {
    errors.push("Minimum amount must be at least 1000");
  }

  if (!maxAmount || maxAmount < minAmount) {
    errors.push("Maximum amount must be greater than minimum amount");
  }

  if (!interestRate || interestRate < 1 || interestRate > 50) {
    errors.push("Interest rate must be between 1% and 50%");
  }

  if (!termOptions || !Array.isArray(termOptions) || termOptions.length === 0) {
    errors.push("At least one term option is required");
  }

  if (!totalOffered || totalOffered < maxAmount) {
    errors.push(
      "Total offered amount must be at least equal to maximum loan amount"
    );
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation errors",
      errors,
    });
  }

  next();
};

export const validateLoanApplication = (req, res, next) => {
  const { requestedAmount, selectedTerm, purpose } = req.body;

  const errors = [];

  if (!requestedAmount || requestedAmount <= 0) {
    errors.push("Requested amount must be greater than 0");
  }

  if (!selectedTerm || selectedTerm <= 0) {
    errors.push("Selected term must be greater than 0");
  }

  if (!purpose) {
    errors.push("Loan purpose is required");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation errors",
      errors,
    });
  }

  next();
};
