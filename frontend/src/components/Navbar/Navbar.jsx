import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const navigate = useNavigate();
  const { isLoggedIn, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className={styles.navbar}>
      <Link to="/home" className={styles.brandLink}>
        PayFree
      </Link>

      <div className={styles.actions}>
        {isLoggedIn ? (
          <>
            <Link to="/account" className={styles.navLink}>
              Account
            </Link>
            <button onClick={handleLogout} className={styles.logoutButton}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className={styles.navLink}>
              Login
            </Link>
            <Link to="/signup" className={styles.navLink}>
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
