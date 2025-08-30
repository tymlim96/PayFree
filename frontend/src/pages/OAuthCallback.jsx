import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Alert from "../components/Alert/Alert";

export default function OAuthCallback() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");

    const finish = async () => {
      if (!token) {
        navigate("/login", { replace: true, state: { msg: "OAuth failed" } });
        return;
      }
      try {
        await login(token); // stores token, fetches /auth/me
        navigate("/trips", { replace: true });
      } catch {
        navigate("/login", { replace: true, state: { msg: "OAuth failed" } });
      }
    };
    finish();
  }, [search, login, navigate]);

  return (
    <div style={{ maxWidth: 420, margin: "2rem auto", padding: "0 1rem" }}>
      <Alert type="info">Signing you in with Google…</Alert>
    </div>
  );
}
