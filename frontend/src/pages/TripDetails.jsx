import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import styles from "./TripDetails.module.css";
import { LinkRow } from "../components/LinkRow";

// Getting directly from token -> stores id
// Check whether current user is owner (unlocks delete btn)
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
  const confirmMatched = confirmText.trim().toLowerCase() === "delete";

  // expenses state
  const [expenses, setExpenses] = useState([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [expErr, setExpErr] = useState("");

  // settlements state
  const [settlements, setSettlements] = useState([]);
  const [loadingSetts, setLoadingSetts] = useState(true);
  const [settsErr, setSettsErr] = useState("");

  // balance state
  const [balance, setBalance] = useState(null); // in cents
  const [balanceCcy, setBalanceCcy] = useState("");
  const [loadingBal, setLoadingBal] = useState(true);
  const [balErr, setBalErr] = useState("");

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

  // fetch expenses
  useEffect(() => {
    (async () => {
      try {
        setLoadingExp(true);
        setExpErr("");
        const jwt = localStorage.getItem("token");
        const res = await axios.get(
          `http://localhost:5000/trips/${id}/expenses`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        setExpenses(res.data?.expenses || []);
      } catch {
        setExpErr("Failed to load expenses");
      } finally {
        setLoadingExp(false);
      }
    })();
  }, [id]);

  // fetch settlements
  useEffect(() => {
    (async () => {
      try {
        setLoadingSetts(true);
        setSettsErr("");
        const jwt = localStorage.getItem("token");
        const res = await axios.get(
          `http://localhost:5000/trips/${id}/settlements`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        setSettlements(
          Array.isArray(res.data?.settlements) ? res.data.settlements : []
        );
      } catch (e) {
        setSettsErr(e?.response?.data?.error || "Failed to load settlements");
      } finally {
        setLoadingSetts(false);
      }
    })();
  }, [id]);

  // fetch balance
  useEffect(() => {
    (async () => {
      try {
        setLoadingBal(true);
        setBalErr("");
        const jwt = localStorage.getItem("token");
        const res = await axios.get(
          `http://localhost:5000/trips/${id}/my-balance`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        setBalance(res.data?.balance_cents ?? 0);
        setBalanceCcy(res.data?.currency_code ?? "");
      } catch {
        setBalErr("Failed to load balance");
      } finally {
        setLoadingBal(false);
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

        <button
          type="button"
          className={`${styles.btn} ${styles.settleBtn}`}
          onClick={() => navigate(`/trips/${id}/settle`)}
          title="Go to settle-up page for this trip"
        >
          Settle Debts
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

      {/* Expenses list */}
      <div className={styles.expensesSection}>
        <div className={styles.expensesHeaderRow}>
          <h3 className={styles.subTitle}>Expenses</h3>

          <div className={styles.expensesSummary}>
            {loadingBal ? (
              <span className={styles.summaryItem}>Calculating debt…</span>
            ) : balErr ? (
              <span className={styles.summaryItem}>{balErr}</span>
            ) : (
              <span
                className={`${styles.summaryItem} ${
                  balance > 0
                    ? styles.debtPositive
                    : balance < 0
                    ? styles.debtNegative
                    : ""
                }`}
                title="Positive = you owe; Negative = others owe you"
              >
                <strong className={styles.debtLabel}>Debt:</strong>&nbsp;
                <strong className={styles.debtAmount}>
                  {balance < 0 && "−"}
                  {(Math.abs(balance) / 100).toFixed(2)} {balanceCcy}
                </strong>
              </span>
            )}
          </div>
        </div>

        {loadingExp ? (
          <div className={styles.emptyCard}>Loading expenses…</div>
        ) : expErr ? (
          <div className={styles.emptyCard}>{expErr}</div>
        ) : expenses.length === 0 ? (
          <div className={styles.emptyCard}>No expenses yet.</div>
        ) : (
          <ul className={styles.expensesList}>
            {expenses.map((e) => (
              <li key={e.id} className={styles.expenseItem}>
                <Link
                  to={`/trips/${id}/expenses/${e.id}`}
                  className={styles.expenseLink}
                >
                  <div className={styles.expenseMain}>
                    <div className={styles.expenseDesc}>{e.description}</div>
                    <div className={styles.expenseAmt}>
                      {(e.amount_cents / 100).toFixed(2)} {e.currency_code}
                    </div>
                  </div>
                  <div className={styles.expenseMeta}>
                    <span>
                      Paid by{" "}
                      <strong>
                        {e.payer_name || `User ${e.paid_by_user_id}`}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>{new Date(e.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <span>
                      {e.split_mode === "equal"
                        ? "Split evenly"
                        : "Manual split"}
                    </span>
                    {e.participants_count > 0 && (
                      <>
                        <span>•</span>
                        <span>
                          {e.participants_count} participant
                          {e.participants_count > 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Settlements list */}
      <div className={styles.settlementsSection}>
        <div className={styles.settlementsHeaderRow}>
          <h3 className={styles.subTitle}>Settlements</h3>
        </div>

        {loadingSetts ? (
          <div className={styles.emptyCard}>Loading settlements…</div>
        ) : settsErr ? (
          <div className={styles.emptyCard}>{settsErr}</div>
        ) : settlements.length === 0 ? (
          <div className={styles.emptyCard}>No settlements recorded yet.</div>
        ) : (
          <ul className={styles.settlementsList}>
            {settlements.map((s) => (
              <li key={s.id} className={styles.settlementItem}>
                <Link
                  to={`/trips/${id}/settlements/${s.id}`}
                  className={styles.settlementLink}
                  title="View settlement details"
                >
                  <div className={styles.settlementCard}>
                    <div className={styles.settlementRow}>
                      <div className={styles.settlementParties}>
                        <strong>
                          {s.from_user_name || `User ${s.from_user_id}`}
                        </strong>
                        &nbsp;→&nbsp;
                        <strong>
                          {s.to_user_name || `User ${s.to_user_id}`}
                        </strong>
                      </div>
                      <div className={styles.settlementAmt}>
                        {(s.amount_cents / 100).toFixed(2)} {s.currency_code}
                      </div>
                    </div>
                    <div className={styles.settlementMeta}>
                      {new Date(s.created_at).toLocaleString()}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

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
