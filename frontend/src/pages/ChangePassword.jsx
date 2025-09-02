import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Alert from "../components/Alert/Alert";
import { LinkRow } from "../components/LinkRow";
import styles from "./Form.module.css";
import { usePolicy } from "../contexts/PolicyContext";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function ChangePassword() {
  const { minPasswordLen } = usePolicy();
  const { hasPassword, setHasPassword } = useAuth(); // ← update context after success
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState(null); // "success" | "error" | null

  const isNewShort =
    newPassword.length > 0 && newPassword.length < minPasswordLen;
  const newMatches = newPassword && confirmNew && newPassword === confirmNew;

  const formValid =
    (!!hasPassword ? !!currentPassword : true) &&
    newPassword &&
    confirmNew &&
    !isNewShort &&
    newMatches;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isNewShort) {
      setMsg(`New password must be at least ${minPasswordLen} characters`);
      setStatus("error");
      return;
    }
    if (!newMatches) {
      setMsg("New passwords do not match");
      setStatus("error");
      return;
    }

    try {
      const body = hasPassword
        ? { currentPassword, newPassword }
        : { newPassword };

      await axios.put(`${API_BASE}/auth/password`, body);

      // If this user had no password (Google-only), reflect the change immediately
      if (!hasPassword) {
        setHasPassword(true);
      }

      navigate("/account", {
        state: { flash: hasPassword ? "Password updated" : "Password set" },
      });
    } catch (err) {
      setMsg(err.response?.data?.error || "Failed to update password");
      setStatus("error");
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>
        {hasPassword ? "Change Password" : "Set Password"}
      </h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        {hasPassword && (
          <input
            className={styles.input}
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        )}

        <input
          className={`${styles.input} ${isNewShort ? styles.inputError : ""}`}
          type="password"
          placeholder={`New password (min ${minPasswordLen})`}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={minPasswordLen}
          title={`At least ${minPasswordLen} characters`}
          required
        />

        <input
          className={`${styles.input} ${
            confirmNew && !newMatches ? styles.inputError : ""
          }`}
          type="password"
          placeholder="Confirm new password"
          value={confirmNew}
          onChange={(e) => setConfirmNew(e.target.value)}
          minLength={minPasswordLen}
          required
        />

        {isNewShort && (
          <Alert type="error">
            New password must be at least {minPasswordLen} characters
          </Alert>
        )}
        {confirmNew && (
          <Alert type={newMatches ? "success" : "error"}>
            {newMatches ? "Passwords match" : "Passwords do not match"}
          </Alert>
        )}
        {msg && (
          <Alert type={status === "error" ? "error" : "success"}>{msg}</Alert>
        )}

        <button
          type="submit"
          className={`${styles.button} ${
            !formValid ? styles.buttonDisabled : ""
          }`}
          disabled={!formValid}
        >
          {hasPassword ? "Save New Password" : "Set Password"}
        </button>
      </form>

      <LinkRow to="/account">← Back to Account</LinkRow>
    </div>
  );
}
