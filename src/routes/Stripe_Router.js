import mongoose from "mongoose";

const Product_Stripe_Schema = new mongoose.Schema({});

const Product = new mongoose.model("Product", Product_Stripe_Schema);

export default Product;
