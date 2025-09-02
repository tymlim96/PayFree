// src/pages/ExpenseDetails.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import styles from "./ExpenseDetails.module.css";
import { LinkRow } from "../components/LinkRow";

export default function ExpenseDetails() {
  const { id: tripId, expenseId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expense, setExpense] = useState(null); // { ...expense fields, shares: [...] }
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmMatched = confirmText.trim().toLowerCase() === "delete";

  useEffect(() => {
    (async () => {
      try {
        const jwt = localStorage.getItem("token");
        const res = await axios.get(
          `http://localhost:5000/trips/${tripId}/expenses/${expenseId}`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        setExpense(res.data.expense);
      } catch (e) {
        setErr(e?.response?.data?.error || "Failed to load expense");
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId, expenseId]);

  const onDelete = async () => {
    if (!confirmMatched) return;
    try {
      setDeleting(true);
      const jwt = localStorage.getItem("token");
      await axios.delete(
        `http://localhost:5000/trips/${tripId}/expenses/${expenseId}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      navigate(`/trips/${tripId}`, { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to delete expense");
      setDeleting(false);
    }
  };

  if (loading) return <p className={styles.center}>Loading…</p>;
  if (err) return <p className={styles.error}>{err}</p>;
  if (!expense) return <p className={styles.empty}>Expense not found</p>;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Expense Details</h2>

      <div className={styles.card}>
        <div className={styles.row}>
          <div className={styles.label}>Description</div>
          <div className={styles.value}>{expense.description}</div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Amount</div>
          <div className={styles.value}>
            {(expense.amount_cents / 100).toFixed(2)} {expense.currency_code}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Paid by</div>
          <div className={styles.value}>
            {expense.payer_name || `User ${expense.paid_by_user_id}`}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Created</div>
          <div className={styles.value}>
            {new Date(expense.created_at).toLocaleString()}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Split</div>
          <div className={styles.value}>
            {expense.split_mode === "equal" ? "Split evenly" : "Manual split"}
          </div>
        </div>

        <div className={styles.sharesBlock}>
          <div className={styles.sharesTitle}>Participants</div>
          {expense.shares?.length ? (
            <ul className={styles.sharesList}>
              {expense.shares.map((s) => (
                <li key={s.user_id}>
                  <span className={styles.shareName}>
                    {s.user_name || `User ${s.user_id}`}
                  </span>
                  <span className={styles.shareAmt}>
                    {(s.share_cents / 100).toFixed(2)} {expense.currency_code}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.helper}>No shares recorded.</div>
          )}
        </div>
      </div>

      <div className={styles.deleteSection}>
        <div className={styles.confirmCard}>
          <p className={styles.confirmText}>
            Anyone in the trip can delete this expense. Type <code>delete</code>{" "}
            to confirm.
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
              Delete Expense
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
