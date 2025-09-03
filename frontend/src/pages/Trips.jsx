import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./Trips.module.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function Trips() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/trips`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTrips(res.data.trips || []);
      } catch (e) {
        setErr("Failed to load trips");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleNewTrip = () => {
    navigate("/trips/new");
  };

  return (
    <div className={styles.container}>
      {/* Header row: title (left) + button (right) */}
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Trips</h2>
        <button
          type="button"
          className={`${styles.btn} ${styles.newTripBtn}`}
          onClick={handleNewTrip}
        >
          + New Trip
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : err ? (
        <p className={styles.error}>{err}</p>
      ) : trips.length === 0 ? (
        <p className={styles.empty}>No trips yet.</p>
      ) : (
        <ul className={styles.list}>
          {trips.map((t) => (
            <li
              key={t.id}
              className={styles.item}
              onClick={() => navigate(`/trips/${t.id}`)}
              style={{ cursor: "pointer" }}
            >
              <div className={styles.itemName}>{t.name}</div>
              <div className={styles.itemMeta}>{t.currency_code || "—"}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
