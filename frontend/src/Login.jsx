
import { useState } from "react";

const API_URL = "http://localhost:5001";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("employee@example.com");
  const [password, setPassword] = useState("TestPassword123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      onLogin(data);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot reach the server. Check that your backend is running on port 5001."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-icon login-icon">₹</div>
        <p className="eyebrow">EXPENSE MANAGEMENT</p>
        <h1>Welcome back</h1>
        <p className="subtitle">
          Sign in to manage your expense vouchers.
        </p>

        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="username"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        {error && <p className="login-error">{error}</p>}

        <button className="primary-button login-button" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p className="login-footer">
          Secure access for Employees, Directors and Accounts.
        </p>
      </form>
    </main>
  );
}
