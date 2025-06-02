import express from "express";
import connectDb from "./config/DbConnect.js";
import { ConfigENV } from "./config/index.js";
import cookieParser from "cookie-parser";
import AuthRouter from "./routes/authRoutes.js";
import passport from "passport";
import session from "express-session";
// import cors from "cors";
import "./config/passport.js";
import swaggerDocs from "./config/swagger.js";
import DataRouter from "./routes/dataRoutes.js";
import ClientRouter from "./routes/clientRoutes.js";
import AccountRoute from "./routes/AccountRoutes.js";
import TransactionRouter from "./routes/TransactionRoutes.js";
import router from "./routes/LoanRoute.js";
import StripeRouter from "./routes/Stripe_Router.js";

const PORT = ConfigENV.PORT || 7000;
const app = express();

connectDb();

// app.use(
//   cors({
//     origin: ["http://localhost:5500", "http://127.0.0.1:5500"],
//     credentials: true,
//   })
// );

app.use(express.static("public"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

app.use(
  session({
    secret: ConfigENV.SESSION_SECRET || "default_secret_key_for_development",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

app.get("/csv-import", (req, res) => {
  res.sendFile("csv-upload.html", { root: "./public" });
});

app.use(passport.initialize());
app.use(passport.session());

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "./public" });
});

// Route definitions
app.use("/Stripe", StripeRouter);
app.use("/auth", AuthRouter);
app.use("/api/v1/user", AuthRouter);
app.use("/data", DataRouter);
app.use("/clients", ClientRouter);
app.use("/accounts", AccountRoute);
app.use("/transaction", TransactionRouter);
app.use("/loan", router);

// Enhanced error handler to better display validation errors
app.use((err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const errors = err.errors || [];

  // Format validation errors for better frontend display
  const formattedErrors = {};
  if (errors && errors.length > 0) {
    errors.forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: Object.keys(formattedErrors).length > 0 ? formattedErrors : errors,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`Server is Running on http://localhost:${PORT}`);
  swaggerDocs(app);
});
