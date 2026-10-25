
import { useEffect, useState } from "react";

const API_URL = "http://localhost:5001";

function VoucherForm({ token, voucher = null, onCancel, onCreated }) {
  const isEditing = Boolean(voucher);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(voucher?.title || "");
    setCategory(voucher?.category || "");
    setAmount(
      voucher?.amount != null ? String(voucher.amount) : ""
    );
    setExpenseDate(
      String(voucher?.expense_date || voucher?.date || "").slice(0, 10)
    );
    setDescription(voucher?.description || "");
    setReceipt(null);
    setError("");
  }, [voucher]);

  function handleReceiptChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      setReceipt(null);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
    ];

    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg"];
    const extension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase();

    if (
      !allowedTypes.includes(file.type) ||
      !allowedExtensions.includes(extension)
    ) {
      setError("Choose a PDF, PNG, or JPEG receipt.");
      event.target.value = "";
      setReceipt(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("The receipt must be 5 MB or smaller.");
      event.target.value = "";
      setReceipt(null);
      return;
    }

    setError("");
    setReceipt(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (
      !title.trim() ||
      !category.trim() ||
      !amount.trim() ||
      !expenseDate
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      setError("Enter an amount with up to two decimal places.");
      return;
    }

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > 9999999999.99
    ) {
      setError("Enter a valid positive amount.");
      return;
    }

    setSaving(true);

    let savedVoucherId = voucher?.id ?? null;
    let voucherSaved = false;

    try {
      const endpoint = isEditing
        ? `${API_URL}/api/vouchers/${voucher.id}`
        : `${API_URL}/api/vouchers`;

      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          category: category.trim(),
          amount: numericAmount,
          expense_date: expenseDate,
          description: description.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Unable to ${isEditing ? "update" : "create"} voucher.`
        );
      }

      savedVoucherId = data.id ?? data.voucher?.id ?? savedVoucherId;
      voucherSaved = true;

      if (!savedVoucherId) {
        throw new Error(
          "Voucher was saved, but its ID was not returned by the server."
        );
      }

      if (receipt) {
        const formData = new FormData();
        formData.append("receipt", receipt);

        const uploadResponse = await fetch(
          `${API_URL}/api/vouchers/${savedVoucherId}/attachment`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        const uploadData = await uploadResponse.json().catch(() => ({}));

        if (!uploadResponse.ok) {
          throw new Error(
            `Voucher saved, but receipt upload failed: ${
              uploadData.message || "Please try again."
            }`
          );
        }
      }

      await onCreated();
    } catch (err) {
      setError(
        err.message ||
          (voucherSaved
            ? "Voucher saved, but another step failed."
            : "Something went wrong. Please try again.")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="voucher-form-section">
      <h2>{isEditing ? "Edit Draft Voucher" : "Create New Voucher"}</h2>

      <form onSubmit={handleSubmit} className="voucher-form">
        <label htmlFor="voucher-title">Title *</label>
        <input
          id="voucher-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          required
          placeholder="e.g. Travel expenses"
        />

        <label htmlFor="voucher-category">Category *</label>
        <input
          id="voucher-category"
          type="text"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          maxLength={100}
          required
          placeholder="e.g. Travel, Food, Office supplies"
        />

        <label htmlFor="voucher-amount">Amount (INR) *</label>
        <input
          id="voucher-amount"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          min="0.01"
          max="9999999999.99"
          step="0.01"
          required
          placeholder="0.00"
        />

        <label htmlFor="voucher-date">Expense date *</label>
        <input
          id="voucher-date"
          type="date"
          value={expenseDate}
          onChange={(event) => setExpenseDate(event.target.value)}
          required
        />

        <label htmlFor="voucher-description">Description</label>
        <textarea
          id="voucher-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Add details about this expense"
        />

        <label htmlFor="voucher-receipt">
          Receipt attachment (optional)
        </label>
        <input
          id="voucher-receipt"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          onChange={handleReceiptChange}
          disabled={saving}
        />

        <small>
          Accepted formats: PDF, PNG, JPG, JPEG. Maximum size: 5 MB.
          {voucher?.attachment_path
            ? " A receipt is already attached. Uploading a new one will replace it."
            : ""}
        </small>

        {receipt && (
          <p className="subtitle">
            Selected receipt: {receipt.name}
          </p>
        )}

        {error && <p className="login-error">{error}</p>}

        <div className="form-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Create Voucher"}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export default VoucherForm;
