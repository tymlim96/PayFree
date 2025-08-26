// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import pool from "./db.js";
import authRoutes from "./routes/auth.js";

dotenv.config(); // loads DB_PORT, DB_*, JWT_SECRET

const app = express();
const DB_PORT = process.env.DB_PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRoutes);

async function start() {
  try {
    await pool.query("SELECT NOW()");
    console.log("PostgreSQL connected");
    app.listen(DB_PORT, () =>
      console.log(`Server running on http://localhost:${DB_PORT}`)
    );
  } catch (err) {
    console.error("DB connect failed:", err);
    process.exit(1);
  }
}

start();
