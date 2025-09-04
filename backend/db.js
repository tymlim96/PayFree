// db.js
import pkg from "pg";
const { Pool } = pkg;

// Pull in .env first
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432, // default Postgres port
  // ssl: false  // add if needed for local dev
});

export default pool;
