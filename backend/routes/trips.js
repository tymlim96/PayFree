// backend/routes/trips.js
import express from "express";
import crypto from "crypto";
import pool from "../db.js";

const router = express.Router();

/** GET /trips - list trips the user belongs to */
router.get("/", async (req, res) => {
  try {
    const q = await pool.query(
      `
      SELECT t.id, t.name, t.currency_code, t.created_at
        FROM trip_members tm
        JOIN trips t ON t.id = tm.trip_id
       WHERE tm.user_id = $1
       ORDER BY t.created_at DESC
      `,
      [req.userId]
    );
    res.json({ trips: q.rows });
  } catch (err) {
    console.error("[TRIPS] LIST ERROR:", err);
    res.status(500).json({ error: "Failed to load trips" });
  }
});

/** POST /trips - create a trip and return a permanent invite_url */
router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, currency_code } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Trip name is required" });
    }

    const code = String(currency_code || "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      return res
        .status(400)
        .json({ error: "Currency code must be a 3-letter ISO code, e.g. USD" });
    }

    await client.query("BEGIN");

    // Insert trip
    const t = await client.query(
      `
      INSERT INTO trips (owner_id, name, currency_code)
      VALUES ($1, $2, $3)
      RETURNING id, owner_id, name, currency_code, created_at, updated_at
      `,
      [req.userId, name.trim(), code]
    );

    const trip = t.rows[0];

    // Add creator as owner in trip_members
    await client.query(
      `
      INSERT INTO trip_members (trip_id, user_id, role)
      VALUES ($1, $2, 'owner')
      ON CONFLICT (trip_id, user_id) DO NOTHING
      `,
      [trip.id, req.userId]
    );

    // Create permanent invite token (no expiry, unlimited use)
    const token = crypto.randomBytes(24).toString("base64url");
    await client.query(
      `
      INSERT INTO trip_invites (trip_id, token, created_by)
      VALUES ($1, $2, $3)
      `,
      [trip.id, token, req.userId]
    );

    await client.query("COMMIT");

    const invite_url = `${process.env.FRONTEND_URL}/join/${token}`;
    res.status(201).json({ trip, invite_url });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[TRIPS] CREATE ERROR:", err);
    res.status(500).json({ error: "Failed to create trip" });
  } finally {
    client.release();
  }
});

/** GET /trips/:id - fetch details of a single trip (member-only) */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const q = await pool.query(
      `
      SELECT t.id, t.name, t.currency_code, t.created_at, t.owner_id, u.full_name AS owner_full_name
        FROM trips t
        JOIN users u ON t.owner_id = u.id
        JOIN trip_members tm ON tm.trip_id = t.id
       WHERE t.id = $1
         AND tm.user_id = $2
      `,
      [id, req.userId]
    );
    if (q.rowCount === 0) {
      return res.status(404).json({ error: "Trip not found or no access" });
    }
    res.json({ trip: q.rows[0] });
  } catch (err) {
    console.error("[TRIPS] DETAIL ERROR:", err);
    res.status(500).json({ error: "Failed to load trip" });
  }
});

/** GET /trips/:id/invite - get permanent invite URL for a trip (member-only) */
router.get("/:id/invite", async (req, res) => {
  try {
    const { id } = req.params;

    const m = await pool.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [id, req.userId]
    );
    if (m.rowCount === 0) return res.status(403).json({ error: "No access" });

    const q = await pool.query(
      `SELECT token FROM trip_invites WHERE trip_id = $1 ORDER BY id ASC LIMIT 1`,
      [id]
    );
    if (q.rowCount === 0) return res.status(404).json({ error: "No invite" });

    const invite_url = `${process.env.FRONTEND_URL}/join/${q.rows[0].token}`;
    res.json({ invite_url });
  } catch (err) {
    console.error("[TRIPS] GET INVITE ERROR:", err);
    res.status(500).json({ error: "Failed to get invite" });
  }
});

/** POST /trips/join/:token - redeem permanent invite (auth required) */
router.post("/join/:token", async (req, res) => {
  const client = await pool.connect();
  try {
    const { token } = req.params;

    await client.query("BEGIN");

    const iq = await client.query(
      `
      SELECT i.trip_id, t.name
        FROM trip_invites i
        JOIN trips t ON t.id = i.trip_id
       WHERE i.token = $1
       FOR UPDATE
      `,
      [token]
    );

    if (iq.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Invite not found" });
    }

    const { trip_id, name } = iq.rows[0];

    // Already a member?
    const exists = await client.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [trip_id, req.userId]
    );
    if (exists.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(200).json({
        joined: true,
        trip_id,
        trip_name: name,
        message: "Already a member",
      });
    }

    // Add as member
    await client.query(
      `
      INSERT INTO trip_members (trip_id, user_id, role)
      VALUES ($1, $2, 'member')
      ON CONFLICT (trip_id, user_id) DO NOTHING
      `,
      [trip_id, req.userId]
    );

    await client.query("COMMIT");
    return res.status(200).json({ joined: true, trip_id, trip_name: name });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[TRIPS] JOIN ERROR:", err);
    return res.status(500).json({ error: "Failed to join trip" });
  } finally {
    client.release();
  }
});

/** DELETE /trips/:id - owner-only delete */
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const t = await client.query(
      "SELECT owner_id FROM trips WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (t.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Trip not found" });
    }

    if (t.rows[0].owner_id !== req.userId) {
      await client.query("ROLLBACK");
      return res
        .status(403)
        .json({ error: "Only the owner can delete this trip" });
    }

    await client.query("DELETE FROM trips WHERE id = $1", [id]);

    await client.query("COMMIT");
    return res.status(204).send();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[TRIPS] DELETE ERROR:", err);
    return res.status(500).json({ error: "Failed to delete trip" });
  } finally {
    client.release();
  }
});

/** GET /trips/:id/members - list members (only if requester is a member) */
router.get("/:id/members", async (req, res) => {
  try {
    const { id } = req.params;

    // requester must be a member of the trip
    const access = await pool.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [id, req.userId]
    );
    if (access.rowCount === 0) {
      return res.status(403).json({ error: "No access" });
    }

    const q = await pool.query(
      `
      SELECT tm.user_id, u.full_name
      FROM trip_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.trip_id = $1
      ORDER BY (tm.user_id = $2) DESC, u.full_name ASC
      `,
      [id, req.userId]
    );

    res.json({ members: q.rows });
  } catch (err) {
    console.error("[TRIPS] MEMBERS ERROR:", err);
    res.status(500).json({ error: "Failed to load members" });
  }
});

/**
 * POST /trips/:id/expenses
 * Body (equal):
 * {
 *   description: string,
 *   amount_cents: number,
 *   currency_code: 'USD',
 *   split_mode: 'equal',
 *   paid_by_user_id: number,
 *   participants: [user_id, ...]   // members who partake
 * }
 *
 * Body (manual):
 * {
 *   description, amount_cents, currency_code,
 *   split_mode: 'manual',
 *   paid_by_user_id: number,
 *   shares: [{ user_id, share_cents }, ...] // must sum to amount_cents
 * }
 */
router.post("/:id/expenses", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: tripId } = req.params;
    const {
      description,
      amount_cents,
      currency_code,
      split_mode,
      paid_by_user_id,
      participants, // for equal
      shares, // for manual
    } = req.body;

    // Basic validations
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: "Description is required" });
    }
    const amountCents = Number(amount_cents);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return res
        .status(400)
        .json({ error: "amount_cents must be a positive integer" });
    }
    const code = String(currency_code || "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      return res
        .status(400)
        .json({ error: "currency_code must be a 3-letter ISO code" });
    }
    const mode = String(split_mode || "").toLowerCase();
    if (!["equal", "manual"].includes(mode)) {
      return res
        .status(400)
        .json({ error: "split_mode must be 'equal' or 'manual'" });
    }
    const payerId = Number(paid_by_user_id);
    if (!Number.isInteger(payerId)) {
      return res.status(400).json({ error: "paid_by_user_id is required" });
    }

    await client.query("BEGIN");

    // Ensure requester is a member of trip
    const access = await client.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, req.userId]
    );
    if (access.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "No access" });
    }

    // Ensure payer is a member of trip (and by default must be the requester)
    const payerIsMember = await client.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, payerId]
    );
    if (payerIsMember.rowCount === 0) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Payer must be a member of the trip" });
    }
    // Optional: enforce payer === requester (comment out if you want to allow others)
    if (payerId !== req.userId) {
      await client.query("ROLLBACK");
      return res
        .status(403)
        .json({ error: "Payer must be the authenticated user" });
    }

    // Optional: verify currency matches trip (soft check)
    const tripRow = await client.query(
      `SELECT currency_code FROM trips WHERE id = $1`,
      [tripId]
    );
    if (tripRow.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Trip not found" });
    }
    // You can enforce currency consistency if desired:
    // if (tripRow.rows[0].currency_code !== code) { ... }

    // Build shares depending on mode
    let finalShares = []; // [{user_id, share_cents}, ...]

    if (mode === "equal") {
      if (!Array.isArray(participants) || participants.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "participants array required for equal split" });
      }
      // Deduplicate and ensure all are members
      const uniq = [...new Set(participants.map((v) => Number(v)))].filter(
        Number.isInteger
      );
      if (uniq.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "participants invalid" });
      }
      const memQ = await client.query(
        `SELECT user_id FROM trip_members WHERE trip_id = $1 AND user_id = ANY($2::int[])`,
        [tripId, uniq]
      );
      if (memQ.rowCount !== uniq.length) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "One or more participants are not trip members" });
      }

      // Distribute evenly with remainder
      const n = uniq.length;
      const base = Math.floor(amountCents / n);
      let remainder = amountCents - base * n;
      finalShares = uniq.map((uid) => ({
        user_id: uid,
        share_cents: base + (remainder-- > 0 ? 1 : 0),
      }));
    } else {
      // manual
      if (!Array.isArray(shares) || shares.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "shares array required for manual split" });
      }
      // Validate & normalize
      const uniqIds = new Set();
      let sum = 0;
      for (const s of shares) {
        const uid = Number(s.user_id);
        const cents = Number(s.share_cents);
        if (!Number.isInteger(uid) || !Number.isInteger(cents) || cents < 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Invalid shares entry" });
        }
        if (uniqIds.has(uid)) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Duplicate user in shares" });
        }
        uniqIds.add(uid);
        sum += cents;
      }
      if (sum !== amountCents) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Shares do not sum to amount_cents" });
      }
      // Ensure all listed users are members
      const ids = [...uniqIds];
      const memQ = await client.query(
        `SELECT user_id FROM trip_members WHERE trip_id = $1 AND user_id = ANY($2::int[])`,
        [tripId, ids]
      );
      if (memQ.rowCount !== ids.length) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "One or more shares users are not trip members" });
      }
      finalShares = shares.map((s) => ({
        user_id: Number(s.user_id),
        share_cents: Number(s.share_cents),
      }));
    }

    // Insert expense
    const expIns = await client.query(
      `
      INSERT INTO expenses (trip_id, paid_by_user_id, description, amount_cents, currency_code, split_mode, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, trip_id, paid_by_user_id, description, amount_cents, currency_code, split_mode, created_at, updated_at
      `,
      [tripId, payerId, description.trim(), amountCents, code, mode, req.userId]
    );
    const expense = expIns.rows[0];

    // Insert shares
    for (const s of finalShares) {
      await client.query(
        `
        INSERT INTO expense_shares (expense_id, user_id, share_cents)
        VALUES ($1, $2, $3)
        `,
        [expense.id, s.user_id, s.share_cents]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({ expense, shares: finalShares });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[TRIPS] CREATE EXPENSE ERROR:", err);
    return res.status(500).json({ error: "Failed to create expense" });
  } finally {
    client.release();
  }
});

export default router;
