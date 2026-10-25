
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

// Verify the JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    req.user = user;
    next();
  });
}

// GET: List vouchers belonging to the logged-in employee
router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM vouchers
       WHERE employee_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Unable to fetch vouchers" });
  }
});

// POST: Create a voucher draft
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { title, description, amount, expense_date, category } = req.body;

    if (!title || !amount || !expense_date || !category) {
      return res.status(400).json({
        message: "Title, amount, expense date, and category are required",
      });
    }

    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: "Amount must be greater than zero" });
    }

    const result = await pool.query(
      `INSERT INTO vouchers
       (employee_id, title, description, amount, expense_date, category, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft')
       RETURNING *`,
      [
        req.user.id,
        title.trim(),
        description || null,
        amount,
        expense_date,
        category.trim(),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Unable to create voucher" });
  }
});

// PUT: Update a voucher only while it is a draft owned by this employee
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { title, description, amount, expense_date, category } = req.body;

    const result = await pool.query(
      `UPDATE vouchers
       SET title = $1,
           description = $2,
           amount = $3,
           expense_date = $4,
           category = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND employee_id = $7 AND status = 'draft'
       RETURNING *`,
      [
        title,
        description || null,
        amount,
        expense_date,
        category,
        req.params.id,
        req.user.id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Draft voucher not found or you do not have permission to edit it",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Unable to update voucher" });
  }
});

// DELETE: Delete a draft owned by this employee
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM vouchers
       WHERE id = $1 AND employee_id = $2 AND status = 'draft'
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Draft voucher not found or you do not have permission to delete it",
      });
    }

    res.json({ message: "Draft voucher deleted successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Unable to delete voucher" });
  }
});


/**
 * POST /api/vouchers/:id/sign
 * Save the employee's signature on their own draft voucher.
 */
router.post("/:id/sign", authenticateToken, async (req, res) => {
  try {
    const { signature_data } = req.body;

    if (
      typeof signature_data !== "string" ||
      !signature_data.trim()
    ) {
      return res.status(400).json({
        message: "Employee signature is required",
      });
    }

    // A signature can only be added to the employee's own draft.
    const voucher = await pool.query(
      `SELECT id FROM vouchers
       WHERE id = $1
         AND employee_id = $2
         AND status = 'draft'`,
      [req.params.id, req.user.id]
    );

    if (voucher.rowCount === 0) {
      return res.status(404).json({
        message: "Draft voucher not found or access denied",
      });
    }

    const result = await pool.query(
      `INSERT INTO voucher_signatures
         (voucher_id, employee_id, signature_data)
       VALUES ($1, $2, $3)
       RETURNING id, voucher_id, employee_id, signed_at`,
      [req.params.id, req.user.id, signature_data.trim()]
    );

    res.status(201).json({
      message: "Employee signature saved",
      signature: result.rows[0],
    });
  } catch (error) {
    console.error("Signature error:", error.message);
    res.status(500).json({
      message: "Unable to save employee signature",
    });
  }
});

/**
 * POST /api/vouchers/:id/submit
 * Submit a signed draft for director approval.
 */
router.post("/:id/submit", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const voucherResult = await client.query(
      `SELECT id, status FROM vouchers
       WHERE id = $1 AND employee_id = $2
       FOR UPDATE`,
      [req.params.id, req.user.id]
    );

    if (voucherResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Voucher not found or access denied",
      });
    }

    const voucher = voucherResult.rows[0];

    if (voucher.status !== "draft") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Only draft vouchers can be submitted",
      });
    }

    const signatureResult = await client.query(
      `SELECT id FROM voucher_signatures
       WHERE voucher_id = $1 AND employee_id = $2`,
      [voucher.id, req.user.id]
    );

    if (signatureResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Please sign the voucher before submitting it",
      });
    }

    const updated = await client.query(
      `UPDATE vouchers
       SET status = 'pending_approval',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [voucher.id]
    );

    await client.query("COMMIT");

    res.json({
      message: "Voucher submitted for director approval",
      voucher: updated.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Submit error:", error.message);
    res.status(500).json({
      message: "Unable to submit voucher",
    });
  } finally {
    client.release();
  }
});


module.exports = router;
