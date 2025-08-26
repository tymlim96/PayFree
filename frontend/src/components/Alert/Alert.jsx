import React from "react";
import styles from "./Alert.module.css";

/**
 * <Alert type="success" | "error" | "info" | "warning">
 *   Message text
 * </Alert>
 */
export default function Alert({ type = "success", children, className = "" }) {
  const role = type === "error" ? "alert" : "status";
  return (
    <div role={role} className={`${styles.alert} ${styles[type]} ${className}`}>
      {children}
    </div>
  );
}
