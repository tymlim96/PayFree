import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar/Navbar";
import Footer from "./components/Footer/Footer";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ResetPasswordRequest from "./pages/ResetPasswordRequest";
import SetNewPassword from "./pages/SetNewPassword";
import OAuthCallback from "./pages/OAuthCallback";
import Account from "./pages/Account";
import ChangePassword from "./pages/ChangePassword";
import { PolicyProvider } from "./contexts/PolicyContext";
import { useAuth } from "./contexts/AuthContext";

function App() {
  return (
    <PolicyProvider>
      <BrowserRouter>
        <MainApp />
      </BrowserRouter>
    </PolicyProvider>
  );
}

/** Gate for private routes */
function RequireAuth() {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}

/** Redirect logged-in users away from /login & /signup */
function RedirectIfAuthed() {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <Navigate to="/home" replace /> : <Outlet />;
}

function MainApp() {
  return (
    <>
      <Navbar />
      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* Public-only pages */}
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/reset-password" element={<ResetPasswordRequest />} />
          <Route path="/reset-password/:token" element={<SetNewPassword />} />
          <Route path="/oauth-callback" element={<OAuthCallback />} />
        </Route>

        {/* Private pages */}
        <Route element={<RequireAuth />}>
          <Route path="/home" element={<Home />} />
          <Route path="/account" element={<Account />} />
          <Route path="/account/change-password" element={<ChangePassword />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <Footer />
    </>
  );
}

export default App;
