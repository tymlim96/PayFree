// src/pages/SettleDebts.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./SettleDebts.module.css";
import { LinkRow } from "../components/LinkRow";

export default function SettleDebts() {
  const { id: tripId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [currency, setCurrency] = useState("");
  const [debts, setDebts] = useState([]); // you owe these people
  const [credits, setCredits] = useState([]); // these people owe you

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const jwt = localStorage.getItem("token");
        const res = await axios.get(
          `http://localhost:5000/trips/${tripId}/ledger`,
          {
            headers: { Authorization: `Bearer ${jwt}` },
          }
        );

        const data = res.data || {};
        setCurrency(data.currency_code || "");
        setDebts(Array.isArray(data.debts) ? data.debts : []);
        setCredits(Array.isArray(data.credits) ? data.credits : []);
      } catch (e) {
        setErr(e?.response?.data?.error || "Failed to load ledger");
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId]);

  const fmt = (cents) => (cents / 100).toFixed(2);

  const totalDebts = debts.reduce((s, d) => s + (d.amount_cents || 0), 0);
  const totalCredits = credits.reduce((s, d) => s + (d.amount_cents || 0), 0);

  if (loading) return <p className={styles.center}>Loading…</p>;
  if (err) return <p className={styles.error}>{err}</p>;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Settle Debts</h2>

      {/* Debts (clickable) */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>
            Debts (
            <span className={styles.totalDebt}>
              total {fmt(totalDebts)} {currency}
            </span>
            )
          </h3>
        </div>

        {debts.length === 0 ? (
          <div className={styles.emptyCard}>You don’t owe anyone 🎉</div>
        ) : (
          <ul className={styles.list}>
            {debts.map((d) => (
              <li key={d.user_id} className={styles.item}>
                <button
                  type="button"
                  className={`${styles.row} ${styles.debtRow}`}
                  onClick={() =>
                    navigate(`/trips/${tripId}/settle/pay/${d.user_id}`)
                  }
                  title={`Settle with ${d.full_name || "User " + d.user_id}`}
                >
                  <div className={styles.person}>
                    <div className={styles.name}>
                      {d.full_name || `User ${d.user_id}`}
                    </div>
                  </div>
                  <div className={styles.amountOwe}>
                    {fmt(d.amount_cents)} {currency}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Credits (read-only) */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>
            Others owe you (
            <span className={styles.totalCredit}>
              total {fmt(totalCredits)} {currency}
            </span>
            )
          </h3>
        </div>

        {credits.length === 0 ? (
          <div className={styles.emptyCard}>No one owes you.</div>
        ) : (
          <ul className={styles.list}>
            {credits.map((c) => (
              <li key={c.user_id} className={styles.item}>
                <div className={`${styles.row} ${styles.creditRow}`}>
                  <div className={styles.person}>
                    <div className={styles.avatar} aria-hidden />
                    <div className={styles.name}>
                      {c.full_name || `User ${c.user_id}`}
                    </div>
                  </div>
                  <div className={styles.amountGet}>
                    {fmt(c.amount_cents)} {currency}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.bottomNav}>
        <LinkRow to={`/trips/${tripId}`}>← Back to Trip</LinkRow>
      </div>
    </div>
  );
}
