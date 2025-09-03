// backend/server.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import tripsRouter from "./routes/trips.js";
import requireAuth from "./middleware/requireAuth.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    // credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/", (_req, res) => res.json({ ok: true }));

// Auth routes (login/signup/me/password reset/etc.)
app.use("/auth", authRoutes);

// Trips
app.use("/trips", requireAuth, tripsRouter);

const PORT = process.env.PORT || 5000;
// Exposes this port to Frontend
app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
