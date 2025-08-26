import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Alert from "../components/Alert/Alert";
import { LinkRow } from "../components/LinkRow";
import styles from "./Account.module.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function Account() {
  const { fullName, email, hasPassword, setFullName } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Flash message (e.g., from ChangePassword redirect or local updates)
  const [flash, setFlash] = useState(location.state?.flash || "");

  // Name edit state
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(fullName || "");

  // Keep input synced with context changes
  useEffect(() => {
    setNameInput(fullName || "");
  }, [fullName]);

  // Clear one-time flash from navigation state
  useEffect(() => {
    if (location.state?.flash) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const onEditName = () => setEditingName(true);

  const onCancelEdit = () => {
    setNameInput(fullName || "");
    setEditingName(false);
  };

  const onSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try {
      await axios.put(`${API_BASE}/auth/name`, { fullName: trimmed });
      setFullName(trimmed);
      setEditingName(false);
      setFlash("Name updated");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update name");
    }
  };

  const goPasswordPage = () => {
    navigate("/account/change-password");
  };

  return (
    <div className={styles.container}>
      <h2>Account</h2>

      {flash && (
        <div style={{ marginBottom: "0.75rem" }}>
          <Alert type="success">{flash}</Alert>
        </div>
      )}

      <div className={styles.card}>
        {/* Email (value aligned to the right column) */}
        <div className={styles.row}>
          <span className={styles.label}>Email</span>
          <div className={styles.actions}>
            <span className={styles.value}>{email}</span>
          </div>
        </div>

        {/* Full Name + inline edit */}
        <div className={styles.row}>
          <span className={styles.label}>Full Name</span>
          {!editingName ? (
            <div className={styles.actions}>
              <span className={styles.value}>{fullName || "—"}</span>
              <button type="button" onClick={onEditName} className={styles.btn}>
                Edit
              </button>
            </div>
          ) : (
            <div className={styles.editRight}>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Full name"
                className={styles.editField}
              />
              <div className={styles.editActions}>
                <button
                  type="button"
                  onClick={onSaveName}
                  className={styles.btn}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className={`${styles.btn} ${styles.cancelButton}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Password row: Change vs Set */}
        <div className={styles.row}>
          <span className={styles.label}>Password</span>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={goPasswordPage}
              className={styles.btn}
            >
              {hasPassword ? "Change Password" : "Set Password"}
            </button>
          </div>
        </div>
      </div>

      <LinkRow to="/home">← Back to Home</LinkRow>
    </div>
  );
}
