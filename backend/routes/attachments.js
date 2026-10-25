
const express = require("express");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const pool = require("../db");

const router = express.Router();

const uploadDirectory = path.resolve(__dirname, "..", "uploads");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  if (!token) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      message: "Authentication is not configured.",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err || !user?.id || !user?.role) {
      return res.status(403).json({
        message: "Invalid or expired token.",
      });
    }

    req.user = user;
    next();
  });
}

router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      message: "Invalid voucher ID.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, employee_id, status, attachment_path
       FROM vouchers
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Voucher not found.",
      });
    }

    const voucher = result.rows[0];
    const role = req.user.role;

    if (
      role === "employee" &&
      String(voucher.employee_id) !== String(req.user.id)
    ) {
      return res.status(403).json({
        message: "You cannot access this receipt.",
      });
    }

    if (
      role === "director" &&
      voucher.status !== "pending_approval"
    ) {
      return res.status(403).json({
        message: "Directors can access receipts for pending vouchers only.",
      });
    }

    if (!["employee", "director", "accounts"].includes(role)) {
      return res.status(403).json({
        message: "Access denied.",
      });
    }

    if (!voucher.attachment_path) {
      return res.status(404).json({
        message: "No receipt is attached to this voucher.",
      });
    }

    const filename = path.basename(voucher.attachment_path);
    const extension = path.extname(filename).toLowerCase();

    if (![".pdf", ".png", ".jpg", ".jpeg"].includes(extension)) {
      return res.status(400).json({
        message: "Unsupported receipt file.",
      });
    }

    const expectedPath = path.resolve(uploadDirectory, filename);

    if (path.dirname(expectedPath) !== uploadDirectory) {
      return res.status(400).json({
        message: "Invalid receipt path.",
      });
    }

    await fs.promises.access(expectedPath, fs.constants.R_OK);

    const contentTypes = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    };

    res.setHeader("Content-Type", contentTypes[extension]);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="receipt${extension}"`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");

    return res.sendFile(expectedPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({
        message: "Receipt file not found on the server.",
      });
    }

    console.error("Receipt access error:", error.message);

    return res.status(500).json({
      message: "Unable to retrieve receipt.",
    });
  }
});

module.exports = router;
