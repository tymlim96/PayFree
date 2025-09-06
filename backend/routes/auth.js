// backend/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";
import { getMailer } from "../lib/mailer.js";

const router = express.Router();

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS || 10);
const MIN_PASSWORD_LEN = Number(process.env.MIN_PASSWORD_LEN || 6);

// Google OAuth client
const oauthClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.OAUTH_REDIRECT_URI
);

/*──────────────────────────────────────────────────────────────
  GET /auth/google
  Start Google OAuth flow
──────────────────────────────────────────────────────────────*/
router.get("/google", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
  });

  // Capture desired post-login destination (safe, relative only)
  const rawFrom = typeof req.query.from === "string" ? req.query.from : "";
  const safeFrom =
    rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/trips";
  res.cookie("oauth_return_to", safeFrom, {
    httpOnly: true, // only server reads it
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
  });

  const url = oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state,
  });

  res.redirect(url);
});

/*──────────────────────────────────────────────────────────────
  GET /auth/google/callback
  Handle Google OAuth callback, issue JWT, redirect to FE
──────────────────────────────────────────────────────────────*/
router.get("/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const stateCookie = req.cookies?.oauth_state;
  const returnToCookie = req.cookies?.oauth_return_to;
  const FRONTEND = process.env.FRONTEND_URL || "http://localhost:3000";

  try {
    if (!state || !stateCookie || state !== stateCookie) {
      return res.redirect(`${FRONTEND}/login?error=oauth_state`);
    }
    res.clearCookie("oauth_state");
    if (returnToCookie) res.clearCookie("oauth_return_to");

    const { tokens } = await oauthClient.getToken(String(code));
    const idToken = tokens.id_token;
    if (!idToken)
      return res.redirect(`${FRONTEND}/login?error=missing_id_token`);

    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = payload.email;
    const fullName = payload.name || "";

    const existing = await pool.query(
      `SELECT id, google_id FROM users WHERE google_id = $1 OR email = $2`,
      [googleId, email]
    );

    let userId;
    if (existing.rows.length) {
      userId = existing.rows[0].id;
      if (!existing.rows[0].google_id) {
        await pool.query(`UPDATE users SET google_id = $1 WHERE id = $2`, [
          googleId,
          userId,
        ]);
      }
    } else {
      const inserted = await pool.query(
        `INSERT INTO users (email, full_name, google_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [email, fullName, googleId]
      );
      userId = inserted.rows[0].id;
    }

    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const redirectUrl = new URL(`${FRONTEND}/oauth-callback`);
    redirectUrl.searchParams.set("token", token);
    if (
      typeof returnToCookie === "string" &&
      returnToCookie.startsWith("/") &&
      !returnToCookie.startsWith("//")
    ) {
      redirectUrl.searchParams.set("return_to", returnToCookie);
    }
    return res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("Google OAuth error:", err);
    return res.redirect(
      `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/login?error=oauth_failed`
    );
  }
});

/*──────────────────────────────────────────────────────────────
  GET /auth/policy
  Return password policy & reset token expiry
──────────────────────────────────────────────────────────────*/
router.get("/policy", (_req, res) => {
  const minPasswordLen = Number(MIN_PASSWORD_LEN || 6);
  const resetTokenExpiresMin = Number(
    process.env.RESET_TOKEN_EXPIRES_MIN || 60
  );
  res.json({ minPasswordLen, resetTokenExpiresMin });
});

/*──────────────────────────────────────────────────────────────
  POST /auth/signup
  Email/Password sign-up
──────────────────────────────────────────────────────────────*/
router.post("/signup", async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({
      error: `Password must be at least ${MIN_PASSWORD_LEN} characters`,
    });
  }
  try {
    const emailNorm = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, created_at`,
      [emailNorm, passwordHash, fullName]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Email already in use" });
    }
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/*──────────────────────────────────────────────────────────────
  POST /auth/login
  Email/Password login -> returns JWT
──────────────────────────────────────────────────────────────*/
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT id, password_hash FROM users WHERE email = $1`,
      [email]
    );
    if (!result.rows.length)
      return res.status(401).json({ error: "Invalid credentials" });

    const { id, password_hash } = result.rows[0];
    if (!password_hash) {
      return res.status(400).json({
        error: "This account uses Google Sign-In. Please continue with Google.",
      });
    }

    const ok = await bcrypt.compare(password, password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/*──────────────────────────────────────────────────────────────
  GET /auth/me
  Return profile info (auth required)
──────────────────────────────────────────────────────────────*/
router.get("/me", requireAuth, async (req, res) => {
  const q = await pool.query(
    `SELECT email, full_name,
      (password_hash IS NOT NULL) AS has_password,
      (google_id IS NOT NULL) AS google_linked
    FROM users WHERE id = $1`,
    [req.userId]
  );
  if (!q.rows.length) return res.status(404).json({ error: "User not found" });
  const r = q.rows[0];
  res.json({
    email: r.email,
    fullName: r.full_name,
    hasPassword: r.has_password,
    googleLinked: r.google_linked,
  });
});

/*──────────────────────────────────────────────────────────────
  PUT /auth/name
  Update full name (auth required)
──────────────────────────────────────────────────────────────*/
router.put("/name", requireAuth, async (req, res) => {
  const { fullName } = req.body;
  if (!fullName?.trim())
    return res.status(400).json({ error: "Full name is required" });
  const q = await pool.query(
    `UPDATE users SET full_name = $1 WHERE id = $2 RETURNING full_name`,
    [fullName.trim(), req.userId]
  );
  if (!q.rows.length) return res.status(404).json({ error: "User not found" });
  res.json({ fullName: q.rows[0].full_name });
});

/*──────────────────────────────────────────────────────────────
  PUT /auth/password
  Add/Change password (auth required)
──────────────────────────────────────────────────────────────*/
router.put("/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({
      error: `New password must be at least ${MIN_PASSWORD_LEN} characters`,
    });
  }

  try {
    const u = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [req.userId]
    );
    if (!u.rows.length)
      return res.status(404).json({ error: "User not found" });

    const hasPassword = !!u.rows[0].password_hash;

    if (hasPassword) {
      if (!currentPassword)
        return res.status(400).json({ error: "Current password required" });
      const ok = await bcrypt.compare(currentPassword, u.rows[0].password_hash);
      if (!ok)
        return res.status(400).json({ error: "Current password is incorrect" });
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      hash,
      req.userId,
    ]);

    res.json({ message: hasPassword ? "Password changed" : "Password set" });
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

/*──────────────────────────────────────────────────────────────
  POST /auth/reset-request
  Begin password reset flow (email link). Always returns generic msg.
──────────────────────────────────────────────────────────────*/
// ---------- Reset password (email flow) ----------
function mailFrom() {
  return process.env.MAIL_FROM || `PayFree <${process.env.SMTP_USER}>`;
}

router.post("/reset-request", async (req, res) => {
  const { email } = req.body;
  const expiresMin = Number(process.env.RESET_TOKEN_EXPIRES_MIN || 60);
  const genericMsg =
    "If this email exists, a password reset link has been sent. Please check your inbox.";

  try {
    const userRes = await pool.query(`SELECT id FROM users WHERE email = $1`, [
      email,
    ]);
    if (!userRes.rows.length) return res.json({ message: genericMsg });

    const userId = userRes.rows[0].id;

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + expiresMin * 60 * 1000);

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used, updated_at)
       VALUES ($1, $2, $3, FALSE, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET token_hash = EXCLUDED.token_hash,
             expires_at = EXCLUDED.expires_at,
             used = FALSE,
             updated_at = NOW()`,
      [userId, tokenHash, expiresAt]
    );

    const link = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/reset-password/${rawToken}`;

    const transporter = await getMailer();
    await transporter.sendMail({
      from: mailFrom(),
      to: email,
      subject: "Reset your PayFree password",
      text: `We received a request to reset your password.
            Set a new password: ${link}
            This link expires in ${expiresMin} minutes.
            If you didn’t request this, you can ignore this email.`,
      html: `
        <p>We received a request to reset your password.</p>
        <p><a href="${link}">Click here to set a new password</a></p>
        <p>This link expires in <strong>${expiresMin} minutes</strong>.</p>
        <p>If you didn’t request this, you can ignore this email.</p>
      `,
    });

    return res.json({ message: genericMsg });
  } catch (err) {
    console.error("RESET-REQUEST ERROR:", err);
    return res.json({ message: genericMsg });
  }
});

/*──────────────────────────────────────────────────────────────
  GET /auth/reset-verify?token=...
  Verify reset token (unused & unexpired)
──────────────────────────────────────────────────────────────*/
router.get("/reset-verify", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Missing token" });
  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const q = await pool.query(
      `SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    if (!q.rows.length) return res.status(400).json({ error: "Invalid token" });
    const row = q.rows[0];
    if (row.used) return res.status(400).json({ error: "Token already used" });
    if (new Date(row.expires_at) < new Date())
      return res.status(400).json({ error: "Token expired" });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Invalid token" });
  }
});

/*──────────────────────────────────────────────────────────────
  POST /auth/reset
  Complete password reset with a valid token
──────────────────────────────────────────────────────────────*/
router.post("/reset", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ error: "Missing fields" });
  if (newPassword.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({
      error: `Password must be at least ${MIN_PASSWORD_LEN} characters`,
    });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const tRes = await pool.query(
      `SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    if (!tRes.rows.length)
      return res.status(400).json({ error: "Invalid token" });

    const { user_id, expires_at, used } = tRes.rows[0];
    if (used) return res.status(400).json({ error: "Token already used" });
    if (new Date(expires_at) < new Date())
      return res.status(400).json({ error: "Token expired" });

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      newHash,
      user_id,
    ]);
    await pool.query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE token_hash = $1`,
      [tokenHash]
    );

    res.json({ message: "Password updated" });
  } catch (err) {
    console.error("RESET ERROR:", err);
    res.status(400).json({ error: "Invalid token" });
  }
});

export default router;
