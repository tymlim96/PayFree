import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import styles from "./Form.module.css";
import Alert from "../components/Alert/Alert";
import { LinkRowSplit } from "../components/LinkRow";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState(null); // "success" | "error" | null

  const location = useLocation();
  const [flashMsg, setFlashMsg] = useState(location.state?.msg || "");
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    if (flashMsg) {
      const timer = setTimeout(() => setFlashMsg(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [flashMsg]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        email,
        password,
      });
      await login(res.data.token);
      setMsg("Logged in successfully");
      setStatus("success");
      navigate("/trips");
    } catch (err) {
      setMsg(err.response?.data?.error || "Login failed");
      setStatus("error");
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Login</h2>
      {flashMsg && <Alert type="success">{flashMsg}</Alert>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          className={styles.input}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className={styles.input}
          type="password"
          placeholder="••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {msg && (
          <Alert type={status === "error" ? "error" : "success"}>{msg}</Alert>
        )}

        <button type="submit" className={styles.button}>
          Login
        </button>
      </form>

      <LinkRowSplit
        left={<Link to="/reset-password">Forgot password?</Link>}
        right={<Link to="/signup">Sign up!</Link>}
      />

      <div className={styles.divider}>or</div>

      <a
        href={`${API_BASE}/auth/google`}
        className={styles.googleBtn}
        aria-label="Continue with Google"
      >
        <span className={styles.googleIcon} aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3">
            <path
              fill="#4285F4"
              d="M533.5 278.4c0-18.4-1.5-36.9-4.8-54.9H272.1v103.9h146.9c-6.3 34.7-25.8 64.2-55 83.9l88.9 69.1c51.9-47.8 80.6-118.3 80.6-202z"
            />
            <path
              fill="#34A853"
              d="M272.1 544.3c73.1 0 134.6-24.1 179.4-65.9l-88.9-69.1c-24.7 16.6-56.4 26.3-90.5 26.3-69.6 0-128.6-46.9-149.8-109.7H31.4v68.9c44.3 87.9 135 149.5 240.7 149.5z"
            />
            <path
              fill="#FBBC05"
              d="M122.3 326c-10.3-30.7-10.3-64 0-94.7v-68.9H31.4c-42 83.9-42 183.6 0 267.5L122.3 326z"
            />
            <path
              fill="#EA4335"
              d="M272.1 107.7c37.9-.6 74.5 13.7 102.3 39.8l76.4-76.4C391.7 23.4 333.3 0 272.1 0 166.4 0 75.7 61.6 31.4 149.5l90.9 68.9C143.6 155.6 202.5 107.7 272.1 107.7z"
            />
          </svg>
        </span>
        <span>Continue with Google</span>
      </a>
    </div>
  );
}
