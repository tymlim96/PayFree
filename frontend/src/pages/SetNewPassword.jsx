import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import Alert from "../components/Alert/Alert";
import { LinkRow } from "../components/LinkRow";
import { usePolicy } from "../contexts/PolicyContext";
import styles from "./AuthForm.module.css";

export default function SetNewPassword() {
  const { minPasswordLen } = usePolicy();
  const { token } = useParams();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState(null); // "success" | "error" | null

  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const isShort = newPassword.length > 0 && newPassword.length < minPasswordLen;
  const matches = newPassword && confirmNew && newPassword === confirmNew;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await axios.get("http://localhost:5000/auth/reset-verify", {
          params: { token },
        });
        if (!mounted) return;
        setValid(true);
      } catch (err) {
        if (!mounted) return;
        setValid(false);
        setMsg(err.response?.data?.error || "Invalid or expired link");
        setStatus("error");
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  const formValid = newPassword && confirmNew && !isShort && matches;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setStatus(null);

    if (isShort) {
      setMsg(`Password must be at least ${minPasswordLen} characters`);
      setStatus("error");
      return;
    }
    if (!matches) {
      setMsg("Passwords do not match");
      setStatus("error");
      return;
    }

    try {
      await axios.post("http://localhost:5000/auth/reset", {
        token,
        newPassword,
      });
      // Send them to login with a flash message
      navigate("/login", {
        state: { msg: "Password updated. Please sign in." },
        replace: true,
      });
    } catch (err) {
      setMsg(err.response?.data?.error || "Failed to set new password");
      setStatus("error");
    }
  };

  if (checking) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Set New Password</h2>
        <div className={styles.form}>Checking link…</div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Set New Password</h2>
        {msg && <Alert type="error">{msg}</Alert>}
        <LinkRow to="/reset-password">Request a new link</LinkRow>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Set New Password</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          className={`${styles.input} ${isShort ? styles.inputError : ""}`}
          type="password"
          placeholder={`New password (min ${minPasswordLen})`}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={minPasswordLen}
          required
        />

        <input
          className={`${styles.input} ${
            confirmNew && !matches ? styles.inputError : ""
          }`}
          type="password"
          placeholder="Confirm new password"
          value={confirmNew}
          onChange={(e) => setConfirmNew(e.target.value)}
          minLength={minPasswordLen}
          required
        />

        {/* Live feedback like Register */}
        {isShort && (
          <Alert type="error">
            Password must be at least {minPasswordLen} characters
          </Alert>
        )}
        {confirmNew && (
          <Alert type={matches ? "success" : "error"}>
            {matches ? "Passwords match" : "Passwords do not match"}
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
          Save New Password
        </button>
      </form>
      <LinkRow to="/login">← Back to Login</LinkRow>
    </div>
  );
}
