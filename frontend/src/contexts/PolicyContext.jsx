import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const PolicyContext = createContext({
  minPasswordLen: 6,
  isPolicyLoading: true,
  error: null,
});

export function PolicyProvider({ children }) {
  const [minPasswordLen, setMinPasswordLen] = useState(6); // sensible default
  const [isPolicyLoading, setIsPolicyLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get("http://localhost:5000/auth/policy");
        if (cancelled) return;
        const n = Number(res.data?.minPasswordLen) || 6;
        setMinPasswordLen(n);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setIsPolicyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PolicyContext.Provider value={{ minPasswordLen, isPolicyLoading, error }}>
      {children}
    </PolicyContext.Provider>
  );
}

export function usePolicy() {
  return useContext(PolicyContext);
}
