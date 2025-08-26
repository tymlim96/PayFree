import React from "react";
import { Link } from "react-router-dom";
import styles from "./LinkRow.module.css";

/** Centered single-link row */
export function LinkRow({ to, children, className = "", ...props }) {
  return (
    <p className={`${styles.linkRow} ${className}`} {...props}>
      {to ? (
        <Link to={to} className={styles.link}>
          {children}
        </Link>
      ) : (
        children
      )}
    </p>
  );
}

/** Split row: left + right (never stacks) */
export function LinkRowSplit({ left, right, className = "", ...props }) {
  return (
    <div className={`${styles.splitRow} ${className}`} {...props}>
      <span className={styles.splitItem}>{left}</span>
      <span className={styles.splitItem}>{right}</span>
    </div>
  );
}
