import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./Form.module.css";
import Alert from "../components/Alert/Alert";
import { LinkRow } from "../components/LinkRow";
import { usePolicy } from "../contexts/PolicyContext";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function SignUp() {
  const { minPasswordLen } = usePolicy();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState(null); // "success" | "error" | null
  const navigate = useNavigate();

  const isPasswordShort =
    password.length > 0 && password.length < minPasswordLen;
  const passwordsMatch =
    password && confirmPassword && password === confirmPassword;
  const formValid =
    fullName &&
    email &&
    password &&
    confirmPassword &&
    !isPasswordShort &&
    passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/auth/signup`, {
        email,
        password,
        fullName,
      });
      navigate("/login", {
        state: { msg: `Signed up: ${res.data.user.email}` },
      });
    } catch (err) {
      setMsg(err.response?.data?.error || "Sign up failed");
      setStatus("error");
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Sign up</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          className={styles.input}
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <input
          className={styles.input}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className={`${styles.input} ${
            isPasswordShort ? styles.inputError : ""
          }`}
          type="password"
          placeholder={`Password (min ${minPasswordLen})`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={minPasswordLen}
          title={`At least ${minPasswordLen} characters`}
          required
        />

        <input
          className={`${styles.input} ${
            confirmPassword && !passwordsMatch ? styles.inputError : ""
          }`}
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={minPasswordLen}
          required
        />

        {isPasswordShort && (
          <Alert type="error">
            Password must be at least {minPasswordLen} characters
          </Alert>
        )}

        {confirmPassword && (
          <Alert type={passwordsMatch ? "success" : "error"}>
            {passwordsMatch ? "Passwords match" : "Passwords do not match"}
          </Alert>
        )}

        {msg && (
          <Alert type={status === "error" ? "error" : "success"}>{msg}</Alert>
        )}

        <button
          type="submit"
          className={`${styles.button}`}
          disabled={!formValid}
        >
          Sign up
        </button>
      </form>

      <LinkRow to="/login">← Back to Login</LinkRow>
    </div>
  );
}
