// db.js
import pkg from "pg";
import dotenv from "dotenv";

const { Pool } = pkg;

if (process.env.NODE_ENV !== "production") {
  // Only used in dev. Docker-compose has env_file config.
  dotenv.config({ path: "../.env" });
}

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432, // default Postgres port
  // ssl: false  // add if needed for local dev
});

export default pool;
