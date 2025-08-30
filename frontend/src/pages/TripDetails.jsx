// src/pages/TripDetails.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./TripDetails.module.css";
import { LinkRow } from "../components/LinkRow";

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

export default function TripDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [showMeta, setShowMeta] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteErr, setInviteErr] = useState("");
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyBtnRef = useRef(null);

  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const confirmMatched = confirmText === "delete";

  const token = localStorage.getItem("token");
  const authedUserId = token ? decodeJwtUserId(token) : null;

  useEffect(() => {
    (async () => {
      try {
        const jwt = localStorage.getItem("token");
        const res = await axios.get(`http://localhost:5000/trips/${id}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        setTrip(res.data.trip);
      } catch {
        setErr("Failed to load trip details");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const fetchInvite = async () => {
    if (inviteUrl || loadingInvite) return;
    try {
      setLoadingInvite(true);
      setInviteErr("");
      const jwt = localStorage.getItem("token");
      const res = await axios.get(`http://localhost:5000/trips/${id}/invite`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      setInviteUrl(res.data?.invite_url || "");
    } catch (e) {
      setInviteErr(e?.response?.data?.error || "Failed to fetch invite link");
    } finally {
      setLoadingInvite(false);
    }
  };

  const onToggleInvite = async () => {
    const next = !showInvite;
    setShowInvite(next);
    if (next && !inviteUrl) {
      await fetchInvite();
      setTimeout(() => copyBtnRef.current?.focus(), 0);
    }
  };

  const onDelete = async () => {
    if (!confirmMatched) return;
    try {
      setDeleting(true);
      const jwt = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/trips/${id}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      navigate("/trips", { replace: true });
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          "Failed to delete trip. You may not be the owner."
      );
      setDeleting(false);
    }
  };

  if (loading) return <p>Loading…</p>;
  if (err) return <p className={styles.error}>{err}</p>;
  if (!trip) return <p className={styles.empty}>Trip not found</p>;

  const isOwner =
    trip && authedUserId && Number(trip.owner_id) === Number(authedUserId);

  return (
    <div className={styles.container}>
      {/* Title */}
      <h2 className={styles.title}>{trip.name}</h2>

      {/* Actions row under title */}
      <div className={styles.actionsRow}>
        <button
          type="button"
          className={`${styles.btn} ${styles.primaryBtn}`}
          onClick={() => setShowMeta(!showMeta)}
        >
          {showMeta ? "Hide Trip Details" : "Show Trip Details"}
        </button>

        <button
          type="button"
          className={`${styles.btn} ${styles.primaryBtn}`}
          onClick={onToggleInvite}
        >
          {showInvite ? "Hide Invite Link" : "Show Invite Link"}
        </button>

        <button
          type="button"
          className={`${styles.btn} ${styles.successBtn}`}
          onClick={() => navigate(`/trips/${id}/expenses/new`)}
        >
          + New Expense
        </button>
      </div>

      {/* Trip meta (conditionally shown) */}
      {showMeta && (
        <div className={styles.metaGrid}>
          <div>
            <div className={styles.metaLabel}>Currency</div>
            <div className={styles.metaValue}>{trip.currency_code}</div>
          </div>
          <div>
            <div className={styles.metaLabel}>Owner</div>
            <div className={styles.metaValue}>
              {trip.owner_full_name || `User ${trip.owner_id}`}
            </div>
          </div>
        </div>
      )}

      {/* Invite card */}
      {showInvite && (
        <div className={styles.inviteCard}>
          <h3 className={styles.inviteHeader}>Invite Link</h3>

          {inviteErr && <p className={styles.error}>{inviteErr}</p>}
          {loadingInvite ? (
            <p>Loading invite…</p>
          ) : (
            <div className={styles.inviteRow}>
              <code className={styles.inviteCode}>{inviteUrl}</code>
              <button
                type="button"
                className={`${styles.btn} ${styles.copyBtn}`}
                ref={copyBtnRef}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  } catch {}
                }}
                disabled={!inviteUrl}
                title={!inviteUrl ? "No invite link available" : ""}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}

          <div className={styles.helper}>
            Share this link to add members. It never expires and can be used
            unlimited times.
          </div>
        </div>
      )}

      {/* Delete section (owner-only) */}
      {isOwner && (
        <div className={styles.deleteSection}>
          {!showDelete ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.dangerBtn} ${styles.fullWidth}`}
              onClick={() => setShowDelete(true)}
            >
              Delete Trip
            </button>
          ) : (
            <div className={styles.confirmCard}>
              <p className={styles.confirmText}>
                This will permanently delete the trip and its data. Type{" "}
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
                  className={`${styles.btn} ${styles.secondaryBtn}`}
                  onClick={() => {
                    setShowDelete(false);
                    setConfirmText("");
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>

                <button
                  className={`${styles.btn} ${styles.dangerBtn}`}
                  onClick={onDelete}
                  disabled={!confirmMatched || deleting}
                  title={!confirmMatched ? "Type 'delete' to enable" : ""}
                >
                  {deleting ? "Deleting…" : "Confirm Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.bottomNav}>
        <LinkRow to="/trips">← Back to Trips</LinkRow>
      </div>
    </div>
  );
}
