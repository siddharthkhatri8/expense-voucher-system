const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

// Verify JWT authentication.
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      message: "Authentication is not configured",
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

// Only directors may access these routes.
function requireDirector(req, res, next) {
  if (req.user.role !== "director") {
    return res.status(403).json({
      message: "Director access required",
    });
  }

  next();
}

// Validate voucher IDs.
function validateVoucherId(req, res, next) {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    return res.status(400).json({
      message: "Invalid voucher ID",
    });
  }

  next();
}

// Validate the signature drawn on the canvas.
function validateDirectorSignature(signature) {
  return (
    typeof signature === "string" &&
    signature.startsWith("data:image/png;base64,") &&
    signature.length <= 1000000
  );
}

// GET: List vouchers pending approval.
router.get(
  "/pending",
  authenticateToken,
  requireDirector,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           v.*,
           u.full_name AS employee_name,
           u.email AS employee_email
         FROM vouchers v
         JOIN users u ON u.id = v.employee_id
         WHERE v.status = 'pending_approval'
         ORDER BY v.created_at ASC`
      );

      return res.json(result.rows);
    } catch (error) {
      console.error("Pending vouchers error:", error.message);

      return res.status(500).json({
        message: "Unable to fetch pending vouchers",
      });
    }
  }
);

// POST: Approve a pending voucher.
router.post(
  "/:id/approve",
  authenticateToken,
  requireDirector,
  validateVoucherId,
  async (req, res) => {
    const { director_signature } = req.body;

    if (!validateDirectorSignature(director_signature)) {
      return res.status(400).json({
        message: "A valid PNG director signature is required",
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const voucherResult = await client.query(
        `SELECT id, status
         FROM vouchers
         WHERE id = $1
         FOR UPDATE`,
        [req.params.id]
      );

      if (
        voucherResult.rowCount === 0 ||
        voucherResult.rows[0].status !== "pending_approval"
      ) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Pending voucher not found",
        });
      }

      const signatureResult = await client.query(
        `SELECT id
         FROM voucher_signatures
         WHERE voucher_id = $1
         LIMIT 1`,
        [req.params.id]
      );

      if (signatureResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Employee signature is missing",
        });
      }

      await client.query(
        `INSERT INTO approvals
          (voucher_id, director_id, decision, director_signature)
         VALUES ($1, $2, 'approved', $3)`,
        [
          req.params.id,
          req.user.id,
          director_signature,
        ]
      );

      const updated = await client.query(
        `UPDATE vouchers
         SET status = 'approved',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [req.params.id]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Voucher approved successfully",
        voucher: updated.rows[0],
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Approval error:", error.message);

      return res.status(500).json({
        message: "Unable to approve voucher",
      });
    } finally {
      if (client) client.release();
    }
  }
);

// POST: Reject a pending voucher with a reason.
router.post(
  "/:id/reject",
  authenticateToken,
  requireDirector,
  validateVoucherId,
  async (req, res) => {
    const { rejection_reason, director_signature } = req.body;

    if (
      typeof rejection_reason !== "string" ||
      !rejection_reason.trim() ||
      rejection_reason.trim().length > 2000
    ) {
      return res.status(400).json({
        message: "A rejection reason is required (maximum 2000 characters)",
      });
    }

    if (!validateDirectorSignature(director_signature)) {
      return res.status(400).json({
        message: "A valid PNG director signature is required",
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const voucherResult = await client.query(
        `SELECT id, status
         FROM vouchers
         WHERE id = $1
         FOR UPDATE`,
        [req.params.id]
      );

      if (
        voucherResult.rowCount === 0 ||
        voucherResult.rows[0].status !== "pending_approval"
      ) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Pending voucher not found",
        });
      }

      const signatureResult = await client.query(
        `SELECT id
         FROM voucher_signatures
         WHERE voucher_id = $1
         LIMIT 1`,
        [req.params.id]
      );

      if (signatureResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Employee signature is missing",
        });
      }

      await client.query(
        `INSERT INTO approvals
          (
            voucher_id,
            director_id,
            decision,
            rejection_reason,
            director_signature
          )
         VALUES ($1, $2, 'rejected', $3, $4)`,
        [
          req.params.id,
          req.user.id,
          rejection_reason.trim(),
          director_signature,
        ]
      );

      const updated = await client.query(
        `UPDATE vouchers
         SET status = 'rejected',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [req.params.id]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Voucher rejected successfully",
        voucher: updated.rows[0],
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Rejection error:", error.message);

      return res.status(500).json({
        message: "Unable to reject voucher",
      });
    } finally {
      if (client) client.release();
    }
  }
);

module.exports = router;