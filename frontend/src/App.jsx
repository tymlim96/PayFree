// frontend/src/App.jsx
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
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ResetPasswordRequest from "./pages/ResetPasswordRequest";
import SetNewPassword from "./pages/SetNewPassword";
import OAuthCallback from "./pages/OAuthCallback";
import Account from "./pages/Account";
import ChangePassword from "./pages/ChangePassword";
import Trips from "./pages/Trips";
import NewTrip from "./pages/NewTrip";
import JoinTrip from "./pages/JoinTrip";
import TripDetails from "./pages/TripDetails";
import NewExpense from "./pages/NewExpense";
import ExpenseDetails from "./pages/ExpenseDetails";
import SettleDebts from "./pages/SettleDebts";
import PaySettlement from "./pages/PaySettlement";
import SettlementDetails from "./pages/SettlementDetails";
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

/** Redirect logged-in users away from /login & /signup (but honor ?from) */
function RedirectIfAuthed() {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) return <Outlet />;

  // Prefer the "from" location we stashed when we sent the user to /login
  const fromLoc = location.state?.from;
  const dest =
    (fromLoc?.pathname ? fromLoc.pathname + (fromLoc.search || "") : null) ||
    "/trips";

  return <Navigate to={dest} replace />;
}

function MainApp() {
  return (
    <>
      <Navbar />
      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/trips" replace />} />

        {/* Public-only pages */}
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/reset-password" element={<ResetPasswordRequest />} />
          <Route path="/reset-password/:token" element={<SetNewPassword />} />
          <Route path="/oauth-callback" element={<OAuthCallback />} />
        </Route>

        {/* Public route that self-redirects to login if needed */}
        <Route path="/join/:token" element={<JoinTrip />} />

        {/* Private pages */}
        <Route element={<RequireAuth />}>
          <Route path="/trips" element={<Trips />} />
          <Route path="/trips/new" element={<NewTrip />} />
          <Route path="/trips/:id" element={<TripDetails />} />
          <Route path="/trips/:id/expenses/new" element={<NewExpense />} />
          <Route
            path="/trips/:id/expenses/:expenseId"
            element={<ExpenseDetails />}
          />
          <Route path="/trips/:id/settle" element={<SettleDebts />} />
          <Route
            path="/trips/:id/settle/pay/:counterpartyId"
            element={<PaySettlement />}
          />
          <Route
            path="/trips/:id/settlements/:settlementId"
            element={<SettlementDetails />}
          />
          <Route path="/account" element={<Account />} />
          <Route path="/account/change-password" element={<ChangePassword />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/trips" replace />} />
      </Routes>
      <Footer />
    </>
  );
}

export default App;
