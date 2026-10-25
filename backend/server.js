
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const pool = require("./db");
const authRoutes = require("./routes/auth");
const voucherRoutes = require("./routes/vouchers");
const directorRoutes = require("./routes/director");
const accountsRoutes = require("./routes/accounts");

app.use(cors());
app.use(express.json());
app.use("/api/vouchers", voucherRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/director", directorRoutes);
app.use("/api/accounts", accountsRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Expense Voucher Management API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Expense Voucher Management System"
  });
});

app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS server_time, current_database() AS database"
    );

    res.json({
      success: true,
      message: "Database connected successfully!",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
