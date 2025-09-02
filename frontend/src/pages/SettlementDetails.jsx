// src/pages/SettlementDetails.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./ExpenseDetails.module.css"; // reuse the same styles
import { LinkRow } from "../components/LinkRow";

export default function SettlementDetails() {
  const { id: tripId, settlementId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [settlement, setSettlement] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmMatched = confirmText.trim().toLowerCase() === "delete";

  useEffect(() => {
    (async () => {
      try {
        const jwt = localStorage.getItem("token");
        const res = await axios.get(
          `http://localhost:5000/trips/${tripId}/settlements/${settlementId}`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        setSettlement(res.data.settlement);
      } catch (e) {
        setErr(e?.response?.data?.error || "Failed to load settlement");
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId, settlementId]);

  const onDelete = async () => {
    if (!confirmMatched) return;
    try {
      setDeleting(true);
      const jwt = localStorage.getItem("token");
      await axios.delete(
        `http://localhost:5000/trips/${tripId}/settlements/${settlementId}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      navigate(`/trips/${tripId}`, { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to delete settlement");
      setDeleting(false);
    }
  };

  if (loading) return <p className={styles.center}>Loading…</p>;
  if (err) return <p className={styles.error}>{err}</p>;
  if (!settlement) return <p className={styles.empty}>Settlement not found</p>;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Settlement Details</h2>

      <div className={styles.card}>
        <div className={styles.row}>
          <div className={styles.label}>From</div>
          <div className={styles.value}>
            {settlement.from_user_name || `User ${settlement.from_user_id}`}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>To</div>
          <div className={styles.value}>
            {settlement.to_user_name || `User ${settlement.to_user_id}`}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Amount</div>
          <div className={styles.value}>
            {(settlement.amount_cents / 100).toFixed(2)}{" "}
            {settlement.currency_code}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Created</div>
          <div className={styles.value}>
            {new Date(settlement.created_at).toLocaleString()}
          </div>
        </div>
      </div>

      <div className={styles.deleteSection}>
        <div className={styles.confirmCard}>
          <p className={styles.confirmText}>
            Anyone in the trip can delete this settlement. Type{" "}
            <code>delete</code> to confirm.
          </p>
          <input
            className={styles.input}
            placeholder="delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={deleting}
          />
          <div className={styles.confirmRow}>
            <button
              type="button"
              className={`${styles.btn} ${styles.secondaryBtn}`}
              onClick={() => navigate(`/trips/${tripId}`)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.dangerBtn}`}
              onClick={onDelete}
              disabled={!confirmMatched || deleting}
              title={!confirmMatched ? "Type 'delete' to enable" : ""}
            >
              Delete Settlement
            </button>
          </div>
        </div>
      </div>

      <div className={styles.bottomNav}>
        <LinkRow to={`/trips/${tripId}`}>← Back to Trip</LinkRow>
      </div>
    </div>
  );
}
