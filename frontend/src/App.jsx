
import { useEffect, useState } from "react";
import Login from "./Login";
import "./App.css";
import VoucherForm from "./VoucherForm";
import VoucherActions from "./VoucherActions";
import DirectorActions from "./DirectorActions";

const API_URL = "http://localhost:5001";

function formatStatus(status = "") {
  return String(status)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function App() {
  const [role, setRole] = useState("employee");
  const [session, setSession] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [showVoucherForm, setShowVoucherForm] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const getEndpoint = (currentRole) =>
    currentRole === "director"
      ? "/api/director/pending"
      : currentRole === "accounts"
        ? "/api/accounts/vouchers"
        : "/api/vouchers";

  async function fetchVoucherRows(currentSession) {
    const response = await fetch(
      `${API_URL}${getEndpoint(currentSession.user.role)}`,
      {
        headers: {
          Authorization: `Bearer ${currentSession.token}`,
        },
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Unable to load vouchers.");
    }

    if (Array.isArray(data)) return data;
    if (Array.isArray(data.vouchers)) return data.vouchers;
    if (Array.isArray(data.data)) return data.data;

    return [];
  }

  useEffect(() => {
    if (!session?.token || !session?.user) {
      setVouchers([]);
      setVoucherError("");
      setLoadingVouchers(false);
      return;
    }

    let cancelled = false;

    async function loadVouchers() {
      setLoadingVouchers(true);
      setVoucherError("");

      try {
        const rows = await fetchVoucherRows(session);

        if (!cancelled) {
          setVouchers(rows);
        }
      } catch (error) {
        if (!cancelled) {
          setVoucherError(
            error.message === "Failed to fetch"
              ? "Cannot connect to the backend. Make sure it is running on port 5001."
              : error.message
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingVouchers(false);
        }
      }
    }

    loadVouchers();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleLogin = (data) => {
    setSession(data);
    setRole(data.user.role);
    setShowVoucherForm(false);
    setEditingVoucher(null);
  };

  const handleLogout = () => {
    setSession(null);
    setRole("employee");
    setVouchers([]);
    setShowVoucherForm(false);
    setEditingVoucher(null);
    setSearchTerm("");
    setStatusFilter("all");
    setCategoryFilter("all");
  };

  const refreshVouchers = async () => {
    if (!session?.token || !session?.user) return;
    const rows = await fetchVoucherRows(session);
    setVouchers(rows);
  };

  const formatAmount = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);

  async function handleDeleteVoucher(voucher) {
    if (voucher.status !== "draft") {
      setVoucherError("Only draft vouchers can be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${voucher.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setVoucherError("");

      const response = await fetch(
        `${API_URL}/api/vouchers/${voucher.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not delete voucher.");
      }

      await refreshVouchers();
    } catch (error) {
      setVoucherError(error.message || "Could not delete voucher.");
    }
  }

  async function handleViewReceipt(voucher) {
    let objectUrl;

    try {
      setVoucherError("");

      const response = await fetch(
        `${API_URL}/api/attachments/${voucher.id}`,
        {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Unable to open receipt.");
      }

      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);

      const newTab = window.open(objectUrl, "_blank");

      if (!newTab) {
        URL.revokeObjectURL(objectUrl);
        throw new Error(
          "Your browser blocked the receipt tab. Allow pop-ups and try again."
        );
      }

      newTab.opener = null;

      // Keep the object URL alive while the new tab displays the document.
      // Revoke it when this page is closed or refreshed.
      window.addEventListener(
        "pagehide",
        () => URL.revokeObjectURL(objectUrl),
        { once: true }
      );
    } catch (error) {
      setVoucherError(error.message || "Unable to open receipt.");
    }
  }

  const visibleVouchers = vouchers.filter((voucher) => {
    const query = searchTerm.trim().toLowerCase();
    const voucherId = String(voucher.id ?? "");

    const matchesSearch =
      !query ||
      String(voucher.title || "").toLowerCase().includes(query) ||
      String(voucher.category || "").toLowerCase().includes(query) ||
      voucherId.includes(query) ||
      `vch-${voucherId.padStart(4, "0")}`.includes(query) ||
      String(voucher.employee_name || "").toLowerCase().includes(query) ||
      String(voucher.full_name || "").toLowerCase().includes(query) ||
      String(voucher.employee_email || "").toLowerCase().includes(query) ||
      String(voucher.email || "").toLowerCase().includes(query);

    const normalizedStatus = String(voucher.status || "")
      .toLowerCase()
      .replaceAll("_", " ");

    const matchesStatus =
      statusFilter === "all" || normalizedStatus === statusFilter;

    const matchesCategory =
      categoryFilter === "all" ||
      String(voucher.category || "").toLowerCase() === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const pendingCount = visibleVouchers.filter(
    (voucher) =>
      String(voucher.status || "").toLowerCase() === "pending_approval"
  ).length;

  const approvedAmount = visibleVouchers
    .filter(
      (voucher) =>
        String(voucher.status || "").toLowerCase() === "approved"
    )
    .reduce((sum, voucher) => sum + (Number(voucher.amount) || 0), 0);

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

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
        <button type="button" className="nav-item active">
          ▦ Dashboard
        </button>

        <div className="sidebar-bottom">
          <div className="avatar">
            {(session.user.full_name || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{session.user.full_name}</strong>
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
            <span>Signed in as</span>
            <strong>{session.user.full_name}</strong>
            <button
              type="button"
              className="primary-button"
              onClick={handleLogout}
            >
              Log out
            </button>
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
            <strong>{pendingCount}</strong>
            <small>Awaiting review</small>
          </article>

          <article className="stat-card">
            <span>Approved amount</span>
            <strong>{formatAmount(approvedAmount)}</strong>
            <small>Approved vouchers</small>
          </article>
        </section>

        {showVoucherForm && role === "employee" && (
          <VoucherForm
            key={editingVoucher ? editingVoucher.id : "new-voucher"}
            token={session.token}
            voucher={editingVoucher}
            onCancel={() => {
              setShowVoucherForm(false);
              setEditingVoucher(null);
            }}
            onCreated={async () => {
              setShowVoucherForm(false);
              setEditingVoucher(null);

              try {
                await refreshVouchers();
                setVoucherError("");
              } catch (error) {
                setVoucherError(
                  error.message || "Could not refresh vouchers."
                );
              }
            }}
          />
        )}

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

              <div className="voucher-filters">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search title, category, or voucher ID..."
                  aria-label="Search vouchers"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="all">All categories</option>
                  {[...new Set(
                    vouchers.map((voucher) => voucher.category).filter(Boolean)
                  )]
                    .sort()
                    .map((category) => (
                      <option key={category} value={category.toLowerCase()}>
                        {category}
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  className="nav-item"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setCategoryFilter("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            </div>

            {role === "employee" && (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setEditingVoucher(null);
                  setVoucherError("");
                  setShowVoucherForm(true);
                }}
              >
                + New voucher
              </button>
            )}
          </div>

          {loadingVouchers && (
            <p className="subtitle">Loading vouchers...</p>
          )}

          {voucherError && (
            <div>
              <p className="login-error">{voucherError}</p>
              <button
                type="button"
                className="primary-button"
                onClick={async () => {
                  setVoucherError("");
                  setLoadingVouchers(true);

                  try {
                    await refreshVouchers();
                  } catch (error) {
                    setVoucherError(
                      error.message || "Could not load vouchers."
                    );
                  } finally {
                    setLoadingVouchers(false);
                  }
                }}
              >
                Retry loading
              </button>
            </div>
          )}

          {!loadingVouchers && !voucherError && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Voucher</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleVouchers.map((voucher) => {
                    const status = formatStatus(voucher.status);
                    const date = voucher.expense_date || voucher.date;
                    const isDraft = voucher.status === "draft";

                    return (
                      <tr key={voucher.id}>
                        <td>
                          <strong>{voucher.title}</strong>
                          <span className="voucher-id">
                            VCH-{String(voucher.id).padStart(4, "0")}
                          </span>
                        </td>

                        <td>{voucher.category || "—"}</td>

                        <td>
                          {date ? String(date).slice(0, 10) : "—"}
                        </td>

                        <td className="amount">
                          {formatAmount(voucher.amount)}
                        </td>

                        <td>
                          <span
                            className={`status status-${String(
                              voucher.status || "unknown"
                            )
                              .toLowerCase()
                              .replaceAll("_", "-")
                              .replaceAll(" ", "-")}`}
                          >
                            {status || "Unknown"}
                          </span>
                        </td>

                        <td>
                          {voucher.attachment_path && (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => handleViewReceipt(voucher)}
                            >
                              View Receipt
                            </button>
                          )}{" "}

                          {role === "employee" && (
                            <>
                              {isDraft && (
                                <>
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => {
                                      setEditingVoucher(voucher);
                                      setVoucherError("");
                                      setShowVoucherForm(true);
                                    }}
                                  >
                                    Edit
                                  </button>{" "}

                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => handleDeleteVoucher(voucher)}
                                  >
                                    Delete
                                  </button>{" "}
                                </>
                              )}

                              <VoucherActions
                                voucher={voucher}
                                token={session.token}
                                onUpdated={async () => {
                                  try {
                                    await refreshVouchers();
                                    setVoucherError("");
                                  } catch (error) {
                                    setVoucherError(
                                      error.message ||
                                        "Could not refresh vouchers."
                                    );
                                  }
                                }}
                              />
                            </>
                          )}

                          {role === "director" && (
                            <DirectorActions
                              voucher={voucher}
                              token={session.token}
                              onUpdated={refreshVouchers}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {visibleVouchers.length === 0 && (
                    <tr>
                      <td colSpan="6">
                        No vouchers found. Create a voucher to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
