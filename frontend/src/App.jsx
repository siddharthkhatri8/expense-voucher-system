
import { useState } from "react";
import "./App.css";

function App() {
  const [role, setRole] = useState("employee");

  const [vouchers] = useState([
    {
      id: 1,
      title: "Office supplies",
      category: "Office",
      amount: 450,
      date: "2026-10-25",
      status: "Draft",
    },
    {
      id: 2,
      title: "Client meeting travel",
      category: "Travel",
      amount: 1200,
      date: "2026-10-24",
      status: "Pending Approval",
    },
    {
      id: 3,
      title: "Software subscription",
      category: "Software",
      amount: 2500,
      date: "2026-10-20",
      status: "Approved",
    },
  ]);

  const formatAmount = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);

  const visibleVouchers =
    role === "employee"
      ? vouchers
      : role === "director"
        ? vouchers.filter((v) => v.status === "Pending Approval")
        : vouchers;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">₹</div>
          <div>
            <h2>ExpenseFlow</h2>
            <span>Voucher Management</span>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <button className="nav-item active">▦ Dashboard</button>
        <button className="nav-item">▤ Expense vouchers</button>
        <button className="nav-item">⚙ Settings</button>

        <div className="sidebar-bottom">
          <div className="avatar">U</div>
          <div>
            <strong>Demo User</strong>
            <span>{role} account</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">WORKSPACE / OVERVIEW</p>
            <h1>Expense Dashboard</h1>
            <p className="subtitle">
              Track, manage, and review your expense vouchers.
            </p>
          </div>

          <div className="role-switch">
            <label htmlFor="role">Preview role</label>
            <select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="employee">Employee</option>
              <option value="director">Director</option>
              <option value="accounts">Accounts Team</option>
            </select>
          </div>
        </header>

        <section className="stats">
          <article className="stat-card">
            <span>Total vouchers</span>
            <strong>{visibleVouchers.length}</strong>
            <small>In this view</small>
          </article>
          <article className="stat-card">
            <span>Pending approval</span>
            <strong>
              {visibleVouchers.filter(
                (v) => v.status === "Pending Approval"
              ).length}
            </strong>
            <small>Awaiting review</small>
          </article>
          <article className="stat-card">
            <span>Approved amount</span>
            <strong>
              {formatAmount(
                visibleVouchers
                  .filter((v) => v.status === "Approved")
                  .reduce((sum, v) => sum + v.amount, 0)
              )}
            </strong>
            <small>Approved vouchers</small>
          </article>
        </section>

        <section className="voucher-section">
          <div className="section-heading">
            <div>
              <h2>
                {role === "director"
                  ? "Vouchers awaiting approval"
                  : role === "accounts"
                    ? "All expense vouchers"
                    : "Recent vouchers"}
              </h2>
              <p>Review voucher details and current status.</p>
            </div>

            {role === "employee" && (
              <button
                className="primary-button"
                onClick={() =>
                  alert("Voucher creation form is our next feature!")
                }
              >
                + New voucher
              </button>
            )}
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Voucher</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleVouchers.map((voucher) => (
                  <tr key={voucher.id}>
                    <td>
                      <strong>{voucher.title}</strong>
                      <span className="voucher-id">
                        VCH-{String(voucher.id).padStart(4, "0")}
                      </span>
                    </td>
                    <td>{voucher.category}</td>
                    <td>{voucher.date}</td>
                    <td className="amount">
                      {formatAmount(voucher.amount)}
                    </td>
                    <td>
                      <span
                        className={`status status-${voucher.status
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                      >
                        {voucher.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {visibleVouchers.length === 0 && (
                  <tr>
                    <td colSpan="5">No vouchers to display.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
