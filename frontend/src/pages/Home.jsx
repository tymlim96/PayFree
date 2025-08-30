// src/pages/Home.jsx
import React from "react";
import { useAuth } from "../contexts/AuthContext";

export default function Home() {
  const { fullName } = useAuth();
  return (
    <div>
      <h2>Hello {fullName}</h2>
      <p>Welcome to PayFree!</p>
    </div>
  );
}
