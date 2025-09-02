// src/pages/NewTrip.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Alert from "../components/Alert/Alert";
import { LinkRow } from "../components/LinkRow";
import { CURRENCIES } from "../constants/currencies";
import tripStyles from "./NewTrip.module.css";
import authStyles from "./AuthForm.module.css";

export default function NewTrip() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState(null);

  const [inviteUrl, setInviteUrl] = useState(""); // when set => hide form
  const [createdTripId, setCreatedTripId] = useState(null);
  const [copied, setCopied] = useState(false);

  const copyBtnRef = useRef(null);

  const onFirstLetterByCode = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length !== 1) return;
    const ch = e.key.toUpperCase();
    if (ch < "A" || ch > "Z") return;
    const idx = CURRENCIES.findIndex((c) => c.code.startsWith(ch));
    if (idx !== -1) {
      e.preventDefault();
      setCurrency(CURRENCIES[idx].code);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setStatus(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setMsg("Trip name is required");
      setStatus("error");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        "http://localhost:5000/trips",
        { name: trimmed, currency_code: currency },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMsg("Trip created! Share this invite link to add members:");
      setStatus("success");
      setInviteUrl(res.data?.invite_url || "");
      setCreatedTripId(res.data?.trip?.id ?? null);
      setCopied(false);
    } catch (err) {
      setMsg(err.response?.data?.error || "Failed to create trip");
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (inviteUrl && copyBtnRef.current) {
      copyBtnRef.current.focus();
    }
  }, [inviteUrl]);

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>
        {inviteUrl ? "Invite Members" : "New Trip"}
      </h2>

      {!inviteUrl && (
        <form onSubmit={onSubmit} className={authStyles.form}>
          <label htmlFor="trip_name">Trip Name</label>
          <input
            id="trip_name"
            type="text"
            className={authStyles.input}
            placeholder="e.g. Japan Winter 2025"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label htmlFor="trip_currency">Currency</label>
          <select
            id="trip_currency"
            className={authStyles.input}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            onKeyDown={onFirstLetterByCode}
            required
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label} ({c.symbol})
              </option>
            ))}
          </select>

          {msg && (
            <Alert type={status === "error" ? "error" : "success"}>{msg}</Alert>
          )}

          <div className={tripStyles.formActions}>
            <button
              type="submit"
              className={`${authStyles.button} ${tripStyles.actionBtn} ${tripStyles.createBtn}`}
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create Trip"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/trips")}
              className={`${authStyles.button} ${tripStyles.actionBtn} ${tripStyles.actionSecondary}`}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {inviteUrl && (
        <>
          {msg && (
            <Alert type={status === "error" ? "error" : "success"}>{msg}</Alert>
          )}

          <div className={tripStyles.inviteCard}>
            <h3 className={tripStyles.inviteHeader}>Invite Link</h3>

            <div className={tripStyles.inviteRow}>
              <code className={tripStyles.inviteCode}>{inviteUrl}</code>
              <button
                type="button"
                className={tripStyles.copyBtn}
                ref={copyBtnRef}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  } catch {}
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className={tripStyles.helper}>
              Share this link to add members. It never expires and can be used
              unlimited times.
            </div>

            <div className={tripStyles.actionRow}>
              <button
                type="button"
                className={`${authStyles.button} ${tripStyles.actionPrimary}`}
                style={{ width: "100%" }}
                onClick={() =>
                  navigate(
                    createdTripId ? `/trips/${createdTripId}` : "/trips",
                    { replace: true }
                  )
                }
              >
                Go to Trip
              </button>
            </div>
          </div>
        </>
      )}

      <LinkRow to="/trips">← Back to Trips</LinkRow>
    </div>
  );
}
