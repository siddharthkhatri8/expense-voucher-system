
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

const router = express.Router();

// RECEIPT UPLOAD CONFIGURATION
const uploadDirectory = path.join(__dirname, "..", "uploads");

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (
      !allowedExtensions.has(extension) ||
      !allowedMimeTypes.has(file.mimetype)
    ) {
      return callback(
        new Error("Only PDF, PNG, and JPEG receipts are allowed.")
      );
    }

    callback(null, true);
  },
});

// AUTHENTICATION

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
    console.error("JWT_SECRET is not configured.");

    return res.status(500).json({
      message: "Authentication is not configured.",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        message: "Invalid or expired token.",
      });
    }

    if (!user || !user.id || !user.role) {
      return res.status(403).json({
        message: "Invalid authentication token.",
      });
    }

    req.user = user;
    next();
  });
}

function requireEmployee(req, res, next) {
  if (req.user.role !== "employee") {
    return res.status(403).json({
      message: "Employee access required.",
    });
  }

  next();
}

// Validate voucher ID parameters.
function validateVoucherId(req, res, next) {
  if (!/^[1-9]\d*$/.test(req.params.id || "")) {
    return res.status(400).json({
      message: "Invalid voucher ID.",
    });
  }

  next();
}


// VOUCHER VALIDATION
function validateVoucher(req, res, next) {
  const { title, description, amount, expense_date, category } = req.body;

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 200 ||
    typeof category !== "string" ||
    !category.trim() ||
    category.trim().length > 100 ||
    typeof expense_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(expense_date) ||
    !Number.isFinite(Date.parse(`${expense_date}T00:00:00Z`)) ||
    !Number.isFinite(Number(amount)) ||
    Number(amount) <= 0 ||
    Number(amount) > 9999999999.99 ||
    !/^\d+(\.\d{1,2})?$/.test(String(amount))
  ) {
    return res.status(400).json({
      message:
        "Provide a valid title, category, positive amount (up to 2 decimals), and expense date.",
    });
  }

  // Ensure the date is a real calendar date.
  const [year, month, day] = expense_date.split("-").map(Number);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));

  if (
    dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() !== month - 1 ||
    dateCheck.getUTCDate() !== day
  ) {
    return res.status(400).json({
      message: "Please provide a valid expense date.",
    });
  }

  if (description != null && typeof description !== "string") {
    return res.status(400).json({
      message: "Description must be text.",
    });
  }

  if (typeof description === "string" && description.length > 2000) {
    return res.status(400).json({
      message: "Description cannot exceed 2000 characters.",
    });
  }

  next();
}


// GET: LIST THE LOGGED-IN EMPLOYEE'S VOUCHERS
router.get(
  "/",
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT *
         FROM vouchers
         WHERE employee_id = $1
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      return res.json(result.rows);
    } catch (error) {
      console.error("Fetch vouchers error:", error.message);

      return res.status(500).json({
        message: "Unable to fetch vouchers.",
      });
    }
  }
);


// POST: CREATE A DRAFT VOUCHER
router.post(
  "/",
  authenticateToken,
  requireEmployee,
  validateVoucher,
  async (req, res) => {
    try {
      const { title, description, amount, expense_date, category } = req.body;

      const result = await pool.query(
        `INSERT INTO vouchers
          (employee_id, title, description, amount, expense_date,
           category, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft')
         RETURNING *`,
        [
          req.user.id,
          title.trim(),
          description?.trim() || null,
          Number(amount),
          expense_date,
          category.trim(),
        ]
      );

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Create voucher error:", error.message);

      return res.status(500).json({
        message: "Unable to create voucher.",
      });
    }
  }
);


// PUT: UPDATE ONLY THE EMPLOYEE'S OWN DRAFT
router.put(
  "/:id",
  authenticateToken,
  requireEmployee,
  validateVoucherId,
  validateVoucher,
  async (req, res) => {
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
         WHERE id = $6
           AND employee_id = $7
           AND status = 'draft'
         RETURNING *`,
        [
          title.trim(),
          description?.trim() || null,
          Number(amount),
          expense_date,
          category.trim(),
          req.params.id,
          req.user.id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          message:
            "Draft voucher not found or you do not have permission to edit it.",
        });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Update voucher error:", error.message);

      return res.status(500).json({
        message: "Unable to update voucher.",
      });
    }
  }
);


// DELETE: DELETE ONLY THE EMPLOYEE'S OWN DRAFT

router.delete(
  "/:id",
  authenticateToken,
  requireEmployee,
  validateVoucherId,
  async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM vouchers
         WHERE id = $1
           AND employee_id = $2
           AND status = 'draft'
         RETURNING id`,
        [req.params.id, req.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          message:
            "Draft voucher not found or you do not have permission to delete it.",
        });
      }

      return res.json({
        message: "Draft voucher deleted successfully.",
      });
    } catch (error) {
      console.error("Delete voucher error:", error.message);

      return res.status(500).json({
        message: "Unable to delete voucher.",
      });
    }
  }
);


// POST: UPLOAD OR REPLACE A RECEIPT ON A DRAFT
// Field name expected from the frontend: "receipt"
router.post(
  "/:id/attachment",
  authenticateToken,
  requireEmployee,
  validateVoucherId,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT id, attachment_path
         FROM vouchers
         WHERE id = $1
           AND employee_id = $2
           AND status = 'draft'`,
        [req.params.id, req.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          message: "Draft voucher not found or access denied.",
        });
      }

      req.voucherForAttachment = result.rows[0];
      next();
    } catch (error) {
      console.error("Receipt permission check error:", error.message);

      return res.status(500).json({
        message: "Unable to verify voucher permissions.",
      });
    }
  },
  (req, res, next) => {
    upload.single("receipt")(req, res, (error) => {
      if (error) {
        const statusCode =
          error instanceof multer.MulterError ? 400 : 400;

        return res.status(statusCode).json({
          message: error.message || "Receipt upload failed.",
        });
      }

      next();
    });
  },
  async (req, res) => {
    let uploadedFilePath;

    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Please select a receipt file.",
        });
      }

      uploadedFilePath = req.file.path;

      const relativePath = path.posix.join(
        "uploads",
        req.file.filename
      );

      const result = await pool.query(
        `UPDATE vouchers
         SET attachment_path = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
           AND employee_id = $3
           AND status = 'draft'
         RETURNING id, attachment_path, updated_at`,
        [relativePath, req.params.id, req.user.id]
      );

      if (result.rowCount === 0) {
        await fs.promises.unlink(uploadedFilePath).catch(() => {});

        return res.status(409).json({
          message: "The voucher is no longer a draft.",
        });
      }

      // Delete the old receipt only if it is inside our upload directory.
      const previousPath = req.voucherForAttachment.attachment_path;

      if (previousPath) {
        const previousFilename = path.basename(previousPath);
        const previousFullPath = path.join(
          uploadDirectory,
          previousFilename
        );

        const previousIsOurUpload =
          previousPath === path.posix.join("uploads", previousFilename) ||
          previousPath === path.win32.join("uploads", previousFilename);

        if (previousIsOurUpload) {
          await fs.promises.unlink(previousFullPath).catch(() => {});
        }
      }

      return res.status(200).json({
        message: "Receipt uploaded successfully.",
        voucher: result.rows[0],
      });
    } catch (error) {
      if (uploadedFilePath) {
        await fs.promises.unlink(uploadedFilePath).catch(() => {});
      }

      console.error("Receipt upload error:", error.message);

      return res.status(500).json({
        message: "Unable to upload receipt.",
      });
    }
  }
);


// POST: SAVE THE EMPLOYEE'S SIGNATURE ON A DRAFT
router.post(
  "/:id/sign",
  authenticateToken,
  requireEmployee,
  validateVoucherId,
  async (req, res) => {
    try {
      const { signature_data } = req.body;

      if (
        typeof signature_data !== "string" ||
        !signature_data.startsWith("data:image/png;base64,") ||
        signature_data.length > 1000000
      ) {
        return res.status(400).json({
          message: "A valid PNG signature is required.",
        });
      }

      const voucher = await pool.query(
        `SELECT id
         FROM vouchers
         WHERE id = $1
           AND employee_id = $2
           AND status = 'draft'`,
        [req.params.id, req.user.id]
      );

      if (voucher.rowCount === 0) {
        return res.status(404).json({
          message: "Draft voucher not found or access denied.",
        });
      }

      const result = await pool.query(
        `INSERT INTO voucher_signatures
          (voucher_id, employee_id, signature_data)
         VALUES ($1, $2, $3)
         RETURNING id, voucher_id, employee_id, signed_at`,
        [req.params.id, req.user.id, signature_data]
      );

      return res.status(201).json({
        message: "Employee signature saved.",
        signature: result.rows[0],
      });
    } catch (error) {
      console.error("Signature error:", error.message);

      return res.status(500).json({
        message: "Unable to save employee signature.",
      });
    }
  }
);


// POST: SUBMIT A SIGNED DRAFT FOR DIRECTOR APPROVAL
router.post(
  "/:id/submit",
  authenticateToken,
  requireEmployee,
  validateVoucherId,
  async (req, res) => {
    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const voucherResult = await client.query(
        `SELECT id, status
         FROM vouchers
         WHERE id = $1
           AND employee_id = $2
         FOR UPDATE`,
        [req.params.id, req.user.id]
      );

      if (voucherResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Voucher not found or access denied.",
        });
      }

      const voucher = voucherResult.rows[0];

      if (voucher.status !== "draft") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Only draft vouchers can be submitted.",
        });
      }

      const signatureResult = await client.query(
        `SELECT id
         FROM voucher_signatures
         WHERE voucher_id = $1
           AND employee_id = $2
         LIMIT 1`,
        [voucher.id, req.user.id]
      );

      if (signatureResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Please sign the voucher before submitting it.",
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

      return res.json({
        message: "Voucher submitted for director approval.",
        voucher: updated.rows[0],
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Submit voucher error:", error.message);

      return res.status(500).json({
        message: "Unable to submit voucher.",
      });
    } finally {
      if (client) client.release();
    }
  }
);

module.exports = router;
