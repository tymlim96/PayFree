// src/pages/JoinTrip.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

export default function JoinTrip() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn } = useAuth();
  const [msg, setMsg] = useState("Joining…");
  const [status, setStatus] = useState(null);

  useEffect(() => {
    (async () => {
      if (!isLoggedIn) {
        navigate("/login", { state: { from: location }, replace: true });
        return;
      }
      try {
        const jwt = localStorage.getItem("token");
        const res = await axios.post(
          `http://localhost:5000/trips/join/${token}`,
          {},
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        setMsg("Joined! Redirecting…");
        setStatus("success");
        const tripId = res.data?.trip_id;
        setTimeout(() => {
          navigate(tripId ? `/trips/${tripId}` : "/trips", { replace: true });
        }, 600);
      } catch (err) {
        setMsg(err.response?.data?.error || "Failed to join");
        setStatus("error");
      }
    })();
  }, [isLoggedIn, token, navigate, location]);

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
      <h2>Join Trip</h2>
      <p style={{ color: status === "error" ? "#d32f2f" : "#333" }}>{msg}</p>
    </div>
  );
}
