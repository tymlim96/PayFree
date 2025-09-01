import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./SettleDebts.module.css";
import { LinkRow } from "../components/LinkRow";

export default function SettleDebts() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const jwt = localStorage.getItem("token");
        const res = await axios.get(
          `http://localhost:5000/trips/${id}/settlements`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        setSettlements(res.data?.settlements || []);
      } catch (e) {
        setErr("Failed to load settlements");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <p>Loading…</p>;
  if (err) return <p className={styles.error}>{err}</p>;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Settle Debts</h2>

      <div className={styles.actionsRow}>
        <button
          type="button"
          className={`${styles.btn} ${styles.newSettleBtn}`}
          onClick={() => navigate(`/trips/${id}/settlements/new`)}
        >
          + Record Settlement
        </button>
      </div>

      {settlements.length === 0 ? (
        <div className={styles.emptyCard}>No settlements yet.</div>
      ) : (
        <ul className={styles.settlementList}>
          {settlements.map((s) => (
            <li key={s.id} className={styles.settlementItem}>
              <div className={styles.settlementRow}>
                <span className={styles.amount}>
                  {(s.amount_cents / 100).toFixed(2)} {s.currency_code}
                </span>
                <span className={styles.meta}>
                  From{" "}
                  <strong>
                    {s.from_user_name || `User ${s.from_user_id}`}
                  </strong>
                  &nbsp;→&nbsp;
                  <strong>{s.to_user_name || `User ${s.to_user_id}`}</strong>
                </span>
                <span className={styles.date}>
                  {new Date(s.created_at).toLocaleString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.bottomNav}>
        <LinkRow to={`/trips/${id}`}>← Back to Trip</LinkRow>
      </div>
    </div>
  );
}
