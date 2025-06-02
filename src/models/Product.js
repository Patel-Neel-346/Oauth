import mongoose from "mongoose";

const Product_Stripe_Schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "usd",
      lowercase: true,
    },
    image: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    stripeProductId: {
      type: String,
      sparse: true,
    },
    stripePriceId: {
      type: String,
      sparse: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    purchases: [
      {
        customerId: {
          type: String,
          required: true,
        },
        customerEmail: {
          type: String,
          required: true,
        },
        paymentIntentId: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        currency: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "succeeded", "failed", "canceled"],
          default: "pending",
        },
        purchaseDate: {
          type: Date,
          default: Date.now,
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
Product_Stripe_Schema.index({ category: 1, isActive: 1 });
Product_Stripe_Schema.index({ "purchases.paymentIntentId": 1 });

const Product = mongoose.model("Product", Product_Stripe_Schema);

export default Product;
