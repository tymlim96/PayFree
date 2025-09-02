import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const navigate = useNavigate();
  const { isLoggedIn, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // Close on route changes via back/forward, or on Escape
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
    setOpen(false);
  };

  const closeMenu = () => setOpen(false);

  return (
    <nav className={styles.navbar}>
      <Link to="/trips" className={styles.brandLink} onClick={closeMenu}>
        PayFree
      </Link>

      {/* Hamburger (shown only on small screens via CSS) */}
      <button
        className={`${styles.hamburger} ${open ? styles.hamburgerOpen : ""}`}
        aria-label="Toggle navigation"
        aria-expanded={open ? "true" : "false"}
        aria-controls="nav-actions"
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      <div
        id="nav-actions"
        className={`${styles.actions} ${open ? styles.actionsOpen : ""}`}
      >
        {isLoggedIn ? (
          <>
            <Link to="/trips" className={styles.navLink} onClick={closeMenu}>
              Trips
            </Link>
            <Link to="/account" className={styles.navLink} onClick={closeMenu}>
              Account
            </Link>
            <button onClick={handleLogout} className={styles.logoutButton}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className={styles.navLink} onClick={closeMenu}>
              Login
            </Link>
            <Link to="/signup" className={styles.navLink} onClick={closeMenu}>
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
