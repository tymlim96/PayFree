import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./AuthForm.module.css";
import Alert from "../components/Alert/Alert";
import { LinkRow } from "../components/LinkRow";
import { usePolicy } from "../contexts/PolicyContext";

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

    // Check minimum length
    // if (isPasswordShort) {
    //   setMsg(`Password must be at least ${minPasswordLen} characters`);
    //   setStatus("error");
    //   return;
    // }

    // Confirm passwords match
    // if (!passwordsMatch) {
    //   setMsg("Password do not match");
    //   setStatus("error");
    //   return;
    // }

    // Sign up submit
    try {
      // POST request
      const res = await axios.post("http://localhost:5000/auth/signup", {
        email,
        password,
        fullName,
      });

      // res.data is always needed
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

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className={isPasswordShort ? styles.inputError : ""}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={minPasswordLen}
          title={`At least ${minPasswordLen} characters`}
          required
        />

        <input
          className={`${
            confirmPassword && !passwordsMatch ? styles.inputError : ""
          }`}
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={minPasswordLen}
          required
        />

        {/* Live feedback */}
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
        {/* Still needed in case of Signup error */}
        {msg && (
          <Alert type={status === "error" ? "error" : "success"}>{msg}</Alert>
        )}
        <button
          type="submit"
          className={`${!formValid ? "disabled" : ""}`}
          disabled={!formValid}
        >
          Sign up
        </button>
      </form>
      <LinkRow to="/login">← Back to Login</LinkRow>
    </div>
  );
}
