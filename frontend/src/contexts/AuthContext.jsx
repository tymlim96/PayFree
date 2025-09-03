import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";

const AuthContext = createContext();
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

function base64UrlToJson(b64url) {
  const b64 = b64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), "=");
  return JSON.parse(atob(b64));
}

function decodeExpMs(token) {
  try {
    const payload = base64UrlToJson(token.split(".")[1]);
    return payload?.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(
    Boolean(localStorage.getItem("token"))
  );
  const [fullName, setFullName] = useState("User");
  const [email, setEmail] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);

  const setAxiosAuthHeader = (token) => {
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setAxiosAuthHeader(null);
    setIsLoggedIn(false);
    setFullName("User");
    setEmail("");
    setHasPassword(false);
    setGoogleLinked(false);
  }, []);

  // Global 401 handler -> log out on unauthorized
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err?.response?.status === 401) logout();
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [logout]);

  // On first load, verify token and hydrate profile
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setAxiosAuthHeader(null);
      return;
    }
    setAxiosAuthHeader(token);
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/auth/me`);
        setFullName(res.data.fullName ?? "User");
        setEmail(res.data.email ?? "");
        setHasPassword(!!res.data.hasPassword);
        setGoogleLinked(!!res.data.googleLinked);
        setIsLoggedIn(true);
      } catch {
        logout();
      }
    })();
  }, [logout]);

  // Auto-logout when JWT expires
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const expMs = decodeExpMs(token);
    if (!expMs) return;
    const msLeft = Math.max(expMs - Date.now(), 0);
    const t = setTimeout(() => logout(), msLeft);
    return () => clearTimeout(t);
  }, [isLoggedIn, logout]);

  // Called after email/password login OR OAuth callback
  const login = async (token) => {
    localStorage.setItem("token", token);
    setAxiosAuthHeader(token);
    setIsLoggedIn(true);
    try {
      const res = await axios.get(`${API_BASE}/auth/me`);
      setFullName(res.data.fullName ?? "User");
      setEmail(res.data.email ?? "");
      setHasPassword(!!res.data.hasPassword);
      setGoogleLinked(!!res.data.googleLinked);
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        fullName,
        email,
        hasPassword,
        googleLinked,
        login,
        logout,
        setFullName,
        setHasPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
