
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        message: "Invalid or expired token",
      });
    }

    req.user = user;
    next();
  });
}

function requireAccounts(req, res, next) {
  if (req.user.role !== "accounts") {
    return res.status(403).json({
      message: "Accounts Team access required",
    });
  }

  next();
}

// Read-only access to all vouchers
router.get("/vouchers", authenticateToken, requireAccounts, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         v.id,
         v.title,
         v.description,
         v.amount,
         v.expense_date,
         v.category,
         v.status,
         v.attachment_path,
         v.created_at,
         v.updated_at,
         u.full_name AS employee_name,
         u.email AS employee_email
       FROM vouchers v
       JOIN users u ON u.id = v.employee_id
       ORDER BY v.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Accounts vouchers error:", error.message);
    res.status(500).json({
      message: "Unable to fetch vouchers",
    });
  }
});

module.exports = router;
