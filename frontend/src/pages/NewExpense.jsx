// src/pages/NewExpense.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { LinkRow } from "../components/LinkRow";
import styles from "./NewExpense.module.css";
import formStyles from "./Form.module.css"; // <-- reuse shared form/input/button

function decodeJwtUserId(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(
      b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=")
    );
    const payload = JSON.parse(json);
    return payload?.userId ?? null;
  } catch {
    return null;
  }
}

export default function NewExpense() {
  const { id: tripId } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [splitMode, setSplitMode] = useState("equal"); // "equal" | "manual"
  const [selected, setSelected] = useState({});
  const [manual, setManual] = useState({});
  const [payerId, setPayerId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const token = localStorage.getItem("token");
  const authedUserId = useMemo(
    () => (token ? decodeJwtUserId(token) : null),
    [token]
  );

  const parseCents = (s) => {
    if (!s) return null;
    const n = Number(String(s).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  };

  const amountCents = useMemo(() => parseCents(amount), [amount]);

  useEffect(() => {
    (async () => {
      try {
        const jwt = localStorage.getItem("token");
        const tripRes = await axios.get(
          `http://localhost:5000/trips/${tripId}`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        setTrip(tripRes.data.trip);

        const memRes = await axios.get(
          `http://localhost:5000/trips/${tripId}/members`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        const mems = memRes.data?.members || [];
        setMembers(mems);

        const initSel = {};
        const initManual = {};
        mems.forEach((m) => {
          initSel[m.user_id] = true;
          initManual[m.user_id] = "";
        });
        setSelected(initSel);
        setManual(initManual);

        if (authedUserId && initSel[authedUserId]) setPayerId(authedUserId);
        else setPayerId(null);
      } catch {
        setErr("Failed to load trip or members");
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId, authedUserId]);

  const selectedIds = useMemo(
    () => members.filter((m) => selected[m.user_id]).map((m) => m.user_id),
    [members, selected]
  );

  useEffect(() => {
    if (payerId && !selectedIds.includes(payerId)) {
      setPayerId(null);
    } else if (!payerId && authedUserId && selectedIds.includes(authedUserId)) {
      setPayerId(authedUserId);
    }
  }, [selectedIds, payerId, authedUserId]);

  const manualTotalCents = useMemo(() => {
    if (splitMode !== "manual") return 0;
    return selectedIds.reduce((sum, uid) => {
      const cents = parseCents(manual[uid] || "0");
      return sum + (cents || 0);
    }, 0);
  }, [splitMode, selectedIds, manual]);

  const manualMismatch =
    splitMode === "manual" &&
    amountCents != null &&
    manualTotalCents !== amountCents;

  const evenShares = useMemo(() => {
    if (splitMode !== "equal") return [];
    if (!amountCents || selectedIds.length === 0) return [];
    const n = selectedIds.length;
    const base = Math.floor(amountCents / n);
    const remainder = amountCents - base * n;
    return selectedIds.map((uid, idx) => ({
      user_id: uid,
      share_cents: base + (idx < remainder ? 1 : 0),
    }));
  }, [splitMode, amountCents, selectedIds]);

  const toggleAll = (val) => {
    const next = {};
    members.forEach((m) => (next[m.user_id] = val));
    setSelected(next);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    const desc = description.trim();
    if (!desc) return setErr("Description is required");
    if (amountCents === null || amountCents <= 0)
      return setErr("Enter a valid amount greater than 0");
    if (selectedIds.length === 0)
      return setErr("Select at least one participant");
    if (!payerId) return setErr("Please select who paid");
    if (!selectedIds.includes(payerId))
      return setErr("Payer must be one of the selected participants");

    try {
      setSubmitting(true);
      const jwt = localStorage.getItem("token");

      const body = {
        description: desc,
        amount_cents: amountCents,
        currency_code: trip?.currency_code,
        split_mode: splitMode,
        paid_by_user_id: payerId,
      };

      if (splitMode === "equal") {
        body.participants = selectedIds;
      } else {
        const shares = selectedIds.map((uid) => ({
          user_id: uid,
          share_cents: parseCents(manual[uid] || "0") || 0,
        }));
        if (shares.reduce((s, r) => s + r.share_cents, 0) !== amountCents) {
          setSubmitting(false);
          return setErr("Manual split must total exactly the expense amount.");
        }
        body.shares = shares;
      }

      await axios.post(`http://localhost:5000/trips/${tripId}/expenses`, body, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      setMsg("Expense added");
      navigate(`/trips/${tripId}`, {
        state: { flash: "Expense added" },
        replace: true,
      });
    } catch (e2) {
      setErr(e2?.response?.data?.error || "Failed to add expense");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className={styles.center}>Loading…</p>;
  if (err && !trip) return <p className={styles.error}>{err}</p>;
  if (!trip) return <p className={styles.empty}>Trip not found</p>;

  const nameFor = (uid) =>
    members.find((m) => m.user_id === uid)?.full_name || `User ${uid}`;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>New Expense</h2>

      <div className={styles.tripMeta}>
        <div>
          <span className={styles.metaLabel}>Trip:</span>{" "}
          <span className={styles.metaValue}>{trip.name}</span>
        </div>
        <div>
          <span className={styles.metaLabel}>Currency:</span>{" "}
          <span className={styles.metaValue}>{trip.currency_code}</span>
        </div>
      </div>

      {/* Use shared form card + page-specific spacing */}
      <form className={`${formStyles.form} ${styles.form}`} onSubmit={onSubmit}>
        <label htmlFor="desc">Description</label>
        <input
          id="desc"
          type="text"
          className={formStyles.input}
          placeholder="e.g. Dinner at Ichiran"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <label htmlFor="amount">Amount ({trip.currency_code})</label>
        <input
          id="amount"
          type="number"
          className={formStyles.input}
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          required
        />

        <div className={styles.participantsHeader}>
          <label htmlFor="participants" className={styles.sectionLabel}>
            Participants
          </label>
          <div className={styles.participantActions}>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => toggleAll(true)}
            >
              Select all
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => toggleAll(false)}
            >
              Clear
            </button>
          </div>
        </div>

        <div id="participants" className={styles.membersGrid}>
          {members.map((m) => (
            <label key={m.user_id} className={styles.memberChip}>
              <input
                type="checkbox"
                checked={!!selected[m.user_id]}
                onChange={(e) =>
                  setSelected((prev) => ({
                    ...prev,
                    [m.user_id]: e.target.checked,
                  }))
                }
              />
              <span>{m.full_name || `User ${m.user_id}`}</span>
            </label>
          ))}
        </div>

        <div className={styles.payerBlock}>
          <label htmlFor="payer" className={styles.sectionLabel}>
            Paid by
          </label>
          <select
            id="payer"
            className={formStyles.input}
            value={payerId ?? ""}
            onChange={(e) =>
              setPayerId(e.target.value ? Number(e.target.value) : null)
            }
            required
            disabled={selectedIds.length === 0}
          >
            <option value="" disabled>
              {selectedIds.length === 0
                ? "Select participants first"
                : "Choose payer"}
            </option>
            {selectedIds.map((uid) => (
              <option key={uid} value={uid}>
                {nameFor(uid)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.sectionHeader}>Split</div>
        <div className={styles.splitTabs}>
          <label className={styles.tab}>
            <input
              type="radio"
              name="split"
              value="equal"
              checked={splitMode === "equal"}
              onChange={() => setSplitMode("equal")}
            />
            <span>Split Evenly</span>
          </label>
          <label className={styles.tab}>
            <input
              type="radio"
              name="split"
              value="manual"
              checked={splitMode === "manual"}
              onChange={() => setSplitMode("manual")}
            />
            <span>Manual Amounts</span>
          </label>
        </div>

        {splitMode === "equal" &&
          amountCents != null &&
          selectedIds.length > 0 && (
            <div className={styles.previewBox}>
              <div className={styles.previewTitle}>Even split preview</div>
              <ul className={styles.previewList}>
                {evenShares.map((s) => (
                  <li key={s.user_id}>
                    <span className={styles.previewName}>
                      {nameFor(s.user_id)}
                    </span>
                    <span className={styles.previewAmt}>
                      {(s.share_cents / 100).toFixed(2)} {trip.currency_code}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        {splitMode === "manual" && (
          <div className={styles.manualTable}>
            {selectedIds.length === 0 ? (
              <div className={styles.helperText}>
                Select at least one participant.
              </div>
            ) : (
              selectedIds.map((uid) => (
                <div key={uid} className={styles.manualRow}>
                  <div className={styles.manualName}>{nameFor(uid)}</div>
                  <div className={styles.manualInputWrap}>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className={`${formStyles.input} ${styles.manualInput}`}
                      value={manual[uid] ?? ""}
                      onChange={(e) =>
                        setManual((prev) => ({
                          ...prev,
                          [uid]: e.target.value,
                        }))
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                    <div className={styles.ccyBadge}>{trip.currency_code}</div>
                  </div>
                </div>
              ))
            )}
            {amountCents != null && (
              <div className={styles.manualTotal}>
                Total entered:{" "}
                <strong>
                  {(manualTotalCents / 100).toFixed(2)} {trip.currency_code}
                </strong>{" "}
                / {(amountCents / 100).toFixed(2)} {trip.currency_code}
              </div>
            )}
            {manualMismatch && (
              <div className={styles.alertError}>
                Manual split must total exactly the expense amount.
              </div>
            )}
          </div>
        )}

        {err && <div className={styles.alertError}>{err}</div>}
        {msg && <div className={styles.alertSuccess}>{msg}</div>}

        <div className={styles.actions}>
          <button
            type="submit"
            className={`${formStyles.button} ${styles.successBtn}`}
            disabled={
              submitting ||
              (splitMode === "manual" && manualMismatch) ||
              selectedIds.length === 0 ||
              !payerId
            }
          >
            {submitting ? "Saving…" : "Add Expense"}
          </button>
          <button
            type="button"
            className={`${formStyles.button} ${styles.secondaryBtn}`}
            onClick={() => navigate(`/trips/${tripId}`)}
          >
            Cancel
          </button>
        </div>
      </form>

      <div className={styles.bottomNav}>
        <LinkRow to={`/trips/${tripId}`}>← Back to Trip</LinkRow>
      </div>
    </div>
  );
}
