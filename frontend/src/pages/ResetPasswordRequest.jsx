import React, { useState } from "react";
import axios from "axios";
import Alert from "../components/Alert/Alert";
import { LinkRow } from "../components/LinkRow";
import styles from "./Form.module.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function ResetPasswordRequest() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState(null); // "success" | "error" | null
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setStatus(null);
    try {
      await axios.post(`${API_BASE}/auth/reset-request`, { email });
      setMsg(
        "If this email exists, a password reset link has been sent. Please check your inbox."
      );
      setStatus("success");
    } catch (err) {
      // We still show generic success to avoid email enumeration,
      // but if you want to show an error, you can:
      setMsg("Something went wrong. Please try again.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Reset Password</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          className={styles.input}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {msg && (
          <Alert type={status === "error" ? "error" : "success"}>{msg}</Alert>
        )}

        <button
          type="submit"
          className={`${styles.button} ${loading ? styles.buttonDisabled : ""}`}
          disabled={loading}
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>

      <LinkRow to="/login">← Back to Login</LinkRow>
    </div>
  );
}
