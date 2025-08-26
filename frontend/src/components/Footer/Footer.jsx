import React from "react";
import styles from "./Footer.module.css";

export default function Footer() {
  const year = new Date().getFullYear();
  return <footer className={styles.footer}>© {year} Tymothy Lim</footer>;
}
