// src/pages/PaySettlement.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./PaySettlement.module.css";
import { LinkRow } from "../components/LinkRow";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function PaySettlement() {
  const { id: tripId, counterpartyId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [currency, setCurrency] = useState("");
  const [debts, setDebts] = useState([]);

  // form state
  const [amountStr, setAmountStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmMatched = confirmText.trim().toLowerCase() === "confirm";
  const cpIdNum = useMemo(() => Number(counterpartyId), [counterpartyId]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const jwt = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/trips/${tripId}/ledger`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        const data = res.data || {};
        setCurrency(data.currency_code || "");
        setDebts(Array.isArray(data.debts) ? data.debts : []);
      } catch (e) {
        setErr(e?.response?.data?.error || "Failed to load ledger");
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId]);

  const cpDebt = useMemo(
    () => debts.find((d) => Number(d.user_id) === cpIdNum) || null,
    [debts, cpIdNum]
  );

  // Prefill input with the max you owe (in decimals)
  useEffect(() => {
    if (cpDebt?.amount_cents != null) {
      setAmountStr((cpDebt.amount_cents / 100).toFixed(2));
    }
  }, [cpDebt]);

  const parseCents = (s) => {
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s.trim())) return null;
    const [intPart, fracPart = ""] = s.split(".");
    const cents = Number(intPart) * 100 + Number((fracPart + "00").slice(0, 2));
    return Number.isFinite(cents) ? cents : null;
  };

  const maxDebtCents = cpDebt?.amount_cents ?? 0;

  const validateAmount = () => {
    const cents = parseCents(amountStr);
    if (cents === null) {
      setErr("Enter a valid amount (e.g., 12.50)");
      return null;
    }
    if (cents <= 0) {
      setErr("Amount must be greater than 0");
      return null;
    }
    if (cents > maxDebtCents) {
      setErr("Amount cannot exceed what you owe");
      return null;
    }
    setErr(""); // clear errors if valid
    return cents;
  };

  const handleShowConfirm = () => {
    const cents = validateAmount();
    if (cents !== null) setConfirming(true);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const cents = validateAmount();
    if (cents === null) return;

    try {
      setSubmitting(true);
      setErr("");
      const jwt = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}/trips/${tripId}/settlements`,
        {
          to_user_id: cpIdNum,
          amount_cents: cents,
        },
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      navigate(`/trips/${tripId}/settle`, { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to create settlement");
      setSubmitting(false);
    }
  };

  if (loading) return <p className={styles.center}>Loading…</p>;
  if (err && !cpDebt) return <p className={styles.error}>{err}</p>;

  if (!cpDebt) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Settle with User {counterpartyId}</h2>
        <div className={styles.emptyCard}>
          You currently don’t owe this person.
        </div>
        <div className={styles.bottomNav}>
          <LinkRow to={`/trips/${tripId}/settle`}>← Back to Settle</LinkRow>
        </div>
      </div>
    );
  }

  const name = cpDebt.full_name || `User ${counterpartyId}`;
  const maxLabel = (maxDebtCents / 100).toFixed(2);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Pay {name}</h2>

      <div className={styles.card}>
        <div className={styles.summary}>
          You owe{" "}
          <span className={styles.owe}>
            {maxLabel} {currency}
          </span>
        </div>

        {err && <p className={styles.error}>{err}</p>}

        <form onSubmit={onSubmit} className={styles.form}>
          <label className={styles.label}>
            Amount to pay
            <input
              type="text"
              inputMode="decimal"
              placeholder={`e.g. ${maxLabel}`}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className={styles.input}
            />
          </label>

          {!confirming ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.payBtn}`}
              onClick={handleShowConfirm}
            >
              Pay
            </button>
          ) : (
            <div className={styles.confirmCard}>
              <p className={styles.confirmText}>
                This will record a payment of {amountStr || "0.00"} {currency}.
                Type <code>confirm</code> below to proceed.
              </p>
              <input
                className={styles.input}
                placeholder="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={submitting}
              />
              <div className={styles.confirmRow}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.secondaryBtn}`}
                  onClick={() => {
                    setConfirming(false);
                    setConfirmText("");
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.payBtn}`}
                  disabled={!confirmMatched || submitting}
                  title={!confirmMatched ? "Type 'confirm' to enable" : ""}
                >
                  {submitting ? "Paying…" : "Confirm Pay"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      <div className={styles.bottomNav}>
        <LinkRow to={`/trips/${tripId}/settle`}>← Back to Settle</LinkRow>
      </div>
    </div>
  );
}
