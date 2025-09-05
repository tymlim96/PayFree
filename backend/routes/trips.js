// backend/routes/trips.js
import express from "express";
import crypto from "crypto";
import pool from "../db.js";

const router = express.Router();

/*──────────────────────────────────────────────────────────────
  GET /trips
  List trips the authenticated user belongs to
──────────────────────────────────────────────────────────────*/
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

/*──────────────────────────────────────────────────────────────
  POST /trips
  Create a new trip and return its permanent invite URL
──────────────────────────────────────────────────────────────*/
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

/*──────────────────────────────────────────────────────────────
  GET /trips/:id
  Fetch details of a single trip (member-only)
──────────────────────────────────────────────────────────────*/
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

/*──────────────────────────────────────────────────────────────
  GET /trips/:id/invite
  Get permanent invite URL for a trip (member-only)
──────────────────────────────────────────────────────────────*/
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

/*──────────────────────────────────────────────────────────────
  POST /trips/join/:token
  Redeem permanent invite (auth required)
──────────────────────────────────────────────────────────────*/
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

/*──────────────────────────────────────────────────────────────
  DELETE /trips/:id
  Delete a trip (owner-only)
──────────────────────────────────────────────────────────────*/
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

/*──────────────────────────────────────────────────────────────
  POST /trips/:id/leave  → current user leaves the trip (non-owner only)
  Removes the caller from trip_members but keeps all their past expenses/shares.
──────────────────────────────────────────────────────────────*/
router.post("/:id/leave", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: tripId } = req.params;

    await client.query("BEGIN");

    // Must be a member
    const mem = await client.query(
      `SELECT role FROM trip_members WHERE trip_id = $1 AND user_id = $2 FOR UPDATE`,
      [tripId, req.userId]
    );
    if (mem.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "No access (not a member)" });
    }

    // Trip owner cannot leave via this route
    const t = await client.query(`SELECT owner_id FROM trips WHERE id = $1`, [
      tripId,
    ]);
    if (t.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Trip not found" });
    }
    if (t.rows[0].owner_id === req.userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "Owner cannot leave. Can only delete trip.",
      });
    }

    // Remove membership
    await client.query(
      `DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, req.userId]
    );

    await client.query("COMMIT");
    return res.status(200).json({ left: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[TRIPS] LEAVE TRIP ERROR:", err);
    return res.status(500).json({ error: "Failed to leave trip" });
  } finally {
    client.release();
  }
});

/*──────────────────────────────────────────────────────────────
  GET /trips/:id/members
  List members of a trip (member-only)
──────────────────────────────────────────────────────────────*/
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

/*──────────────────────────────────────────────────────────────
  POST /trips/:id/expenses
  Create an expense (equal or manual split)
──────────────────────────────────────────────────────────────*/
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

    // Ensure requester is a member of the trip
    const access = await client.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, req.userId]
    );
    if (access.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "No access" });
    }

    // Ensure payer is a member of the trip (but may differ from requester)
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

    // Optional: verify currency matches trip (soft check)
    const tripRow = await client.query(
      `SELECT currency_code FROM trips WHERE id = $1`,
      [tripId]
    );
    if (tripRow.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Trip not found" });
    }

    // Build shares depending on mode
    let finalShares = []; // [{ user_id, share_cents }, ...]

    if (mode === "equal") {
      if (!Array.isArray(participants) || participants.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "participants array required for equal split" });
      }
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

/*──────────────────────────────────────────────────────────────
  GET /trips/:id/expenses
  List expenses for a trip (member-only)
──────────────────────────────────────────────────────────────*/
router.get("/:id/expenses", async (req, res) => {
  try {
    const { id: tripId } = req.params;

    // requester must be a member of the trip
    const access = await pool.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, req.userId]
    );
    if (access.rowCount === 0) {
      return res.status(403).json({ error: "No access" });
    }

    // list expenses with payer info
    const q = await pool.query(
      `
      SELECT
        e.id,
        e.description,
        e.amount_cents,
        e.currency_code,
        e.split_mode,
        e.paid_by_user_id,
        e.created_at,
        u.full_name AS payer_name
      FROM expenses e
      JOIN users u ON u.id = e.paid_by_user_id
      WHERE e.trip_id = $1
      ORDER BY e.created_at DESC
      `,
      [tripId]
    );

    // (Optional) also include participants count for each expense
    const ids = q.rows.map((r) => r.id);
    let counts = {};
    if (ids.length > 0) {
      const cq = await pool.query(
        `
        SELECT expense_id, COUNT(*)::int AS participants_count
          FROM expense_shares
        WHERE expense_id = ANY($1::int[])
        GROUP BY expense_id
        `,
        [ids]
      );
      counts = Object.fromEntries(
        cq.rows.map((r) => [r.expense_id, r.participants_count])
      );
    }

    const expenses = q.rows.map((r) => ({
      ...r,
      participants_count: counts[r.id] ?? 0,
    }));

    return res.json({ expenses });
  } catch (err) {
    console.error("[TRIPS] LIST EXPENSES ERROR:", err);
    return res.status(500).json({ error: "Failed to load expenses" });
  }
});

/*──────────────────────────────────────────────────────────────
  GET /trips/:id/my-balance
  Your net debt for this trip, including settlements and
  per-counterparty netting (consistent with /ledger).

  Returns: { balance_cents, currency_code }
  Positive => you owe others; Negative => others owe you
──────────────────────────────────────────────────────────────*/
router.get("/:id/my-balance", async (req, res) => {
  const tripId = Number(req.params.id);
  const me = req.userId;

  if (!Number.isFinite(tripId)) {
    return res.status(400).json({ error: "Invalid trip id" });
  }

  try {
    // Must be a member
    const access = await pool.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, me]
    );
    if (access.rowCount === 0) {
      return res.status(403).json({ error: "No access" });
    }

    // Trip currency
    const t = await pool.query(
      `SELECT currency_code FROM trips WHERE id = $1`,
      [tripId]
    );
    if (t.rowCount === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }
    const currency_code = t.rows[0].currency_code;

    // Debts from expenses: I participated; someone else paid => I owe them my share
    const debtsQ = await pool.query(
      `
      SELECT
        e.paid_by_user_id            AS user_id,
        SUM(es.share_cents)::bigint  AS amount_cents
      FROM expense_shares es
      JOIN expenses e ON e.id = es.expense_id
      WHERE e.trip_id = $1
        AND es.user_id = $2
        AND e.paid_by_user_id <> $2
      GROUP BY e.paid_by_user_id
      `,
      [tripId, me]
    );

    // Credits from expenses: I paid; others participated => they owe me their shares
    const creditsQ = await pool.query(
      `
      SELECT
        es.user_id                   AS user_id,
        SUM(es.share_cents)::bigint  AS amount_cents
      FROM expenses e
      JOIN expense_shares es ON es.expense_id = e.id
      WHERE e.trip_id = $1
        AND e.paid_by_user_id = $2
        AND es.user_id <> $2
      GROUP BY es.user_id
      `,
      [tripId, me]
    );

    // Settlements: I paid others (reduces my debts to them)
    const settIPaidQ = await pool.query(
      `
      SELECT to_user_id AS user_id, SUM(amount_cents)::bigint AS paid_cents
      FROM settlements
      WHERE trip_id = $1 AND from_user_id = $2
      GROUP BY to_user_id
      `,
      [tripId, me]
    );

    // Settlements: others paid me (reduces their credits owed to me)
    const settPaidToMeQ = await pool.query(
      `
      SELECT from_user_id AS user_id, SUM(amount_cents)::bigint AS paid_cents
      FROM settlements
      WHERE trip_id = $1 AND to_user_id = $2
      GROUP BY from_user_id
      `,
      [tripId, me]
    );

    // Index settlements
    const paidByMe = new Map(); // user_id -> cents I paid them
    const paidToMe = new Map(); // user_id -> cents they paid me
    for (const r of settIPaidQ.rows)
      paidByMe.set(r.user_id, Number(r.paid_cents));
    for (const r of settPaidToMeQ.rows)
      paidToMe.set(r.user_id, Number(r.paid_cents));

    // Build maps AFTER subtracting settlements, clamped at 0 per counterparty
    const debtsMap = new Map(); // I owe them
    for (const r of debtsQ.rows) {
      const base = Number(r.amount_cents);
      const reduce = paidByMe.get(r.user_id) || 0;
      const remaining = Math.max(0, base - reduce);
      if (remaining > 0) debtsMap.set(r.user_id, remaining);
    }

    const creditsMap = new Map(); // they owe me
    for (const r of creditsQ.rows) {
      const base = Number(r.amount_cents);
      const reduce = paidToMe.get(r.user_id) || 0;
      const remaining = Math.max(0, base - reduce);
      if (remaining > 0) creditsMap.set(r.user_id, remaining);
    }

    // Net per counterparty -> totals
    let totalDebts = 0; // sum of amounts I owe (post-settlement, post-net)
    let totalCredits = 0; // sum of amounts they owe me (post-settlement, post-net)

    const allIds = new Set([...debtsMap.keys(), ...creditsMap.keys()]);
    for (const uid of allIds) {
      const d = debtsMap.get(uid) || 0;
      const c = creditsMap.get(uid) || 0;
      const net = c - d; // positive => they owe me; negative => I owe them
      if (net > 0) totalCredits += net;
      else if (net < 0) totalDebts += -net;
      // net == 0 => fully settled with this user
    }

    const balance_cents = totalDebts - totalCredits; // +ve you owe; -ve others owe you
    return res.json({ balance_cents, currency_code });
  } catch (err) {
    console.error("[TRIPS] MY BALANCE ERROR:", err);
    return res.status(500).json({ error: "Failed to load balance" });
  }
});

/*──────────────────────────────────────────────────────────────
  GET /trips/:id/expenses/:expenseId
  Expense details (member-only)
──────────────────────────────────────────────────────────────*/
router.get("/:id/expenses/:expenseId", async (req, res) => {
  try {
    const { id: tripId, expenseId } = req.params;

    // requester must be a member
    const access = await pool.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, req.userId]
    );
    if (access.rowCount === 0) {
      return res.status(403).json({ error: "No access" });
    }

    // expense (ensure belongs to trip)
    const q = await pool.query(
      `
      SELECT
        e.id,
        e.trip_id,
        e.description,
        e.amount_cents,
        e.currency_code,
        e.split_mode,
        e.paid_by_user_id,
        e.created_at,
        u.full_name AS payer_name
      FROM expenses e
      JOIN users u ON u.id = e.paid_by_user_id
      WHERE e.id = $1 AND e.trip_id = $2
      `,
      [expenseId, tripId]
    );
    if (q.rowCount === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }

    const expense = q.rows[0];

    // shares + user names
    const s = await pool.query(
      `
      SELECT es.user_id, es.share_cents, u.full_name AS user_name
      FROM expense_shares es
      JOIN users u ON u.id = es.user_id
      WHERE es.expense_id = $1
      ORDER BY u.full_name ASC
      `,
      [expenseId]
    );
    expense.shares = s.rows;

    return res.json({ expense });
  } catch (err) {
    console.error("[TRIPS] EXPENSE DETAIL ERROR:", err);
    return res.status(500).json({ error: "Failed to load expense" });
  }
});

/*──────────────────────────────────────────────────────────────
  DELETE /trips/:id/expenses/:expenseId
  Delete an expense (member-only)
──────────────────────────────────────────────────────────────*/
router.delete("/:id/expenses/:expenseId", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: tripId, expenseId } = req.params;

    await client.query("BEGIN");

    // requester must be a member
    const access = await client.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, req.userId]
    );
    if (access.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "No access" });
    }

    // ensure the expense belongs to this trip
    const found = await client.query(
      `SELECT id FROM expenses WHERE id = $1 AND trip_id = $2 FOR UPDATE`,
      [expenseId, tripId]
    );
    if (found.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Expense not found" });
    }

    // cascade delete shares then expense (or rely on FK cascade if set)
    await client.query(`DELETE FROM expense_shares WHERE expense_id = $1`, [
      expenseId,
    ]);
    await client.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);

    await client.query("COMMIT");
    return res.status(204).send();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[TRIPS] DELETE EXPENSE ERROR:", err);
    return res.status(500).json({ error: "Failed to delete expense" });
  } finally {
    client.release();
  }
});

/*──────────────────────────────────────────────────────────────
  GET /trips/:id/ledger
  Returns per-counterparty NET amounts, split into:
  - debts  (you owe them)
  - credits (they owe you)
  Logic: net = credits_to_me - debts_to_them
──────────────────────────────────────────────────────────────*/
router.get("/:id/ledger", async (req, res) => {
  const tripId = Number(req.params.id);
  const me = req.userId;

  if (!Number.isFinite(tripId)) {
    return res.status(400).json({ error: "Invalid trip id" });
  }

  try {
    // 1) Ensure requester is a member of the trip (authorization)
    const mem = await pool.query(
      `
      SELECT 1
      FROM trip_members
      WHERE trip_id = $1 AND user_id = $2
      LIMIT 1
      `,
      [tripId, me]
    );
    if (mem.rowCount === 0) {
      return res.status(403).json({ error: "Not a member of this trip" });
    }

    // 2) Get trip currency for display
    const tripRow = await pool.query(
      `SELECT currency_code FROM trips WHERE id = $1`,
      [tripId]
    );
    if (tripRow.rowCount === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }
    const currencyCode = tripRow.rows[0].currency_code;

    // 3) Debts from expenses: I participated; someone else paid
    //    => I owe the payer my share
    const debtsQ = await pool.query(
      `
      SELECT
        e.paid_by_user_id            AS user_id,
        COALESCE(u.full_name, '')    AS full_name,
        SUM(es.share_cents)::bigint  AS amount_cents
      FROM expense_shares es
      JOIN expenses e ON e.id = es.expense_id
      JOIN users u    ON u.id = e.paid_by_user_id
      WHERE e.trip_id = $1
        AND es.user_id = $2        -- me as participant
        AND e.paid_by_user_id <> $2
      GROUP BY e.paid_by_user_id, u.full_name
      `,
      [tripId, me]
    );

    // 4) Credits from expenses: I paid; others participated
    //    => Others owe me their shares
    const creditsQ = await pool.query(
      `
      SELECT
        es.user_id                   AS user_id,
        COALESCE(u.full_name, '')    AS full_name,
        SUM(es.share_cents)::bigint  AS amount_cents
      FROM expenses e
      JOIN expense_shares es ON es.expense_id = e.id
      JOIN users u          ON u.id = es.user_id
      WHERE e.trip_id = $1
        AND e.paid_by_user_id = $2  -- me as payer
        AND es.user_id <> $2
      GROUP BY es.user_id, u.full_name
      `,
      [tripId, me]
    );

    // 5) Settlements I paid to others (reduce my debts to them)
    const settIPaidQ = await pool.query(
      `
      SELECT
        to_user_id                AS user_id,
        SUM(amount_cents)::bigint AS paid_cents
      FROM settlements
      WHERE trip_id = $1
        AND from_user_id = $2
      GROUP BY to_user_id
      `,
      [tripId, me]
    );

    // 6) Settlements others paid to me (reduce their credits owed to me)
    const settPaidToMeQ = await pool.query(
      `
      SELECT
        from_user_id              AS user_id,
        SUM(amount_cents)::bigint AS paid_cents
      FROM settlements
      WHERE trip_id = $1
        AND to_user_id = $2
      GROUP BY from_user_id
      `,
      [tripId, me]
    );

    // Index settlements for quick lookups
    const paidByMe = new Map(); // user_id -> cents I paid them (reduces my debts)
    const paidToMe = new Map(); // user_id -> cents they paid me (reduces their credits)
    for (const r of settIPaidQ.rows)
      paidByMe.set(r.user_id, Number(r.paid_cents));
    for (const r of settPaidToMeQ.rows)
      paidToMe.set(r.user_id, Number(r.paid_cents));

    // Build maps { user_id -> { name, amount_cents } } AFTER settlements
    const debtsMap = new Map(); // what I owe them, after subtracting what I already paid
    for (const r of debtsQ.rows) {
      const base = Number(r.amount_cents);
      const reduce = paidByMe.get(r.user_id) || 0;
      const remaining = Math.max(0, base - reduce);
      if (remaining > 0) {
        debtsMap.set(r.user_id, {
          full_name: r.full_name || null,
          cents: remaining,
        });
      }
    }

    const creditsMap = new Map(); // what they owe me, after subtracting what they already paid me
    for (const r of creditsQ.rows) {
      const base = Number(r.amount_cents);
      const reduce = paidToMe.get(r.user_id) || 0;
      const remaining = Math.max(0, base - reduce);
      if (remaining > 0) {
        creditsMap.set(r.user_id, {
          full_name: r.full_name || null,
          cents: remaining,
        });
      }
    }

    // NET per counterparty: credits - debts
    const allIds = new Set([...debtsMap.keys(), ...creditsMap.keys()]);
    const debts = [];
    const credits = [];

    for (const uid of allIds) {
      const d = debtsMap.get(uid)?.cents || 0;
      const c = creditsMap.get(uid)?.cents || 0;
      const name =
        (creditsMap.get(uid)?.full_name ?? debtsMap.get(uid)?.full_name) ||
        null;

      const net = c - d; // positive => they owe me; negative => I owe them
      if (net > 0) {
        credits.push({ user_id: uid, full_name: name, amount_cents: net });
      } else if (net < 0) {
        debts.push({ user_id: uid, full_name: name, amount_cents: -net });
      }
      // net == 0 => omit (fully settled)
    }

    // Sort biggest first
    debts.sort((a, b) => b.amount_cents - a.amount_cents);
    credits.sort((a, b) => b.amount_cents - a.amount_cents);

    return res.json({
      currency_code: currencyCode,
      debts,
      credits,
    });
  } catch (e) {
    console.error("GET /trips/:id/ledger error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/*──────────────────────────────────────────────────────────────
  GET /trips/:id/settlements
  Get all settlements for a trip (visible to members)
──────────────────────────────────────────────────────────────*/
router.get("/:id/settlements", async (req, res) => {
  const tripId = Number(req.params.id);

  if (!Number.isFinite(tripId)) {
    return res.status(400).json({ error: "Invalid trip id" });
  }

  try {
    // requester must be a member
    const access = await pool.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, req.userId]
    );
    if (access.rowCount === 0) {
      return res.status(403).json({ error: "No access" });
    }

    const q = await pool.query(
      `
      SELECT 
        s.id,
        s.trip_id,
        s.from_user_id,
        fu.full_name AS from_user_name,
        s.to_user_id,
        tu.full_name AS to_user_name,
        s.amount_cents,
        s.currency_code,
        s.created_at
      FROM settlements s
      JOIN users fu ON fu.id = s.from_user_id
      JOIN users tu ON tu.id = s.to_user_id
      WHERE s.trip_id = $1
      ORDER BY s.created_at DESC
      `,
      [tripId]
    );

    return res.json({ settlements: q.rows });
  } catch (e) {
    console.error("[TRIPS] LIST SETTLEMENTS ERROR:", e);
    return res.status(500).json({ error: "Failed to fetch settlements" });
  }
});

/*──────────────────────────────────────────────────────────────
  POST /trips/:id/settlements
  Records a settlement (payment) from the current user (from_user_id)
  to another member (to_user_id) within the same trip.

  Validations:
    - Both users must be members of the trip
    - Cannot settle with yourself
    - Amount must be > 0 and not exceed current outstanding debt
──────────────────────────────────────────────────────────────*/
router.post("/:id/settlements", async (req, res) => {
  const tripId = Number(req.params.id);
  const me = req.userId;
  const { to_user_id, amount_cents } = req.body || {};

  if (!Number.isFinite(tripId)) {
    return res.status(400).json({ error: "Invalid trip id" });
  }
  const toUserId = Number(to_user_id);
  const amt = Number(amount_cents);

  if (!Number.isFinite(toUserId) || toUserId <= 0) {
    return res.status(400).json({ error: "Invalid to_user_id" });
  }
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: "Invalid amount_cents" });
  }
  if (toUserId === me) {
    return res.status(400).json({ error: "Cannot settle with yourself" });
  }

  try {
    // 1) Ensure both requester and counterparty are members of the trip
    const mem = await pool.query(
      `
      SELECT user_id FROM trip_members
      WHERE trip_id = $1 AND user_id IN ($2, $3)
      `,
      [tripId, me, toUserId]
    );
    const members = new Set(mem.rows.map((r) => Number(r.user_id)));
    if (!members.has(me) || !members.has(toUserId)) {
      return res.status(403).json({ error: "Both users must be trip members" });
    }

    // 2) Get trip currency
    const t = await pool.query(
      `SELECT currency_code FROM trips WHERE id = $1`,
      [tripId]
    );
    if (t.rowCount === 0)
      return res.status(404).json({ error: "Trip not found" });
    const currencyCode = t.rows[0].currency_code;

    // 3) (Optional but recommended) compute current net to prevent overpaying
    //    We'll reuse your ledger logic by calling the same SQL pieces quickly
    //    Get how much I currently owe 'toUserId' AFTER settlements (netted)
    const netQ = await pool.query(
      `
      WITH debts AS (
        -- I owe them
        SELECT COALESCE(SUM(es.share_cents),0)::bigint AS cents
        FROM expense_shares es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.trip_id = $1
          AND es.user_id = $2      -- me as participant
          AND e.paid_by_user_id = $3
      ),
      debts_after_settle AS (
        SELECT GREATEST(
          (SELECT cents FROM debts)
          - COALESCE((
              SELECT SUM(amount_cents) FROM settlements
              WHERE trip_id = $1 AND from_user_id = $2 AND to_user_id = $3
            ),0), 0
        )::bigint AS cents
      ),
      credits AS (
        -- They owe me
        SELECT COALESCE(SUM(es.share_cents),0)::bigint AS cents
        FROM expense_shares es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.trip_id = $1
          AND e.paid_by_user_id = $2
          AND es.user_id = $3
      ),
      credits_after_settle AS (
        SELECT GREATEST(
          (SELECT cents FROM credits)
          - COALESCE((
              SELECT SUM(amount_cents) FROM settlements
              WHERE trip_id = $1 AND from_user_id = $3 AND to_user_id = $2
            ),0), 0
        )::bigint AS cents
      )
      SELECT
        (SELECT cents FROM credits_after_settle) AS credits_to_me,
        (SELECT cents FROM debts_after_settle)   AS debts_to_them
      `,
      [tripId, me, toUserId]
    );

    const { credits_to_me, debts_to_them } = netQ.rows[0];
    const net = Number(credits_to_me) - Number(debts_to_them);
    // If net >= 0 => they owe me; If net < 0 => I owe them (-net)
    const iOweNow = net < 0 ? -net : 0;

    if (iOweNow <= 0) {
      return res
        .status(400)
        .json({ error: "No outstanding debt to this user" });
    }
    if (amt > iOweNow) {
      return res.status(400).json({ error: "Amount exceeds outstanding debt" });
    }

    // 4) Insert settlement
    const ins = await pool.query(
      `
      INSERT INTO settlements (trip_id, from_user_id, to_user_id, amount_cents, currency_code, created_by)
      VALUES ($1, $2, $3, $4, $5, $2)
      RETURNING id, trip_id, from_user_id, to_user_id, amount_cents, currency_code, created_at
      `,
      [tripId, me, toUserId, amt, currencyCode]
    );

    // 5) Return created row + updated ledger for convenience
    //    You can skip this re-fetch if you prefer; frontend already navigates back.
    //    But it's handy if you want to show a toast with new totals.
    // minimal fetch: call your GET /ledger handler again if you want full consistency
    return res.status(201).json({
      settlement: ins.rows[0],
      message: "Settlement recorded",
    });
  } catch (e) {
    console.error("POST /trips/:id/settlements error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/*──────────────────────────────────────────────────────────────
  GET /trips/:id/settlements/:settlementId
  Fetch single settlement details (member-only)
──────────────────────────────────────────────────────────────*/
router.get("/:id/settlements/:settlementId", async (req, res) => {
  const tripId = Number(req.params.id);
  const settlementId = Number(req.params.settlementId);

  if (!Number.isFinite(tripId) || !Number.isFinite(settlementId)) {
    return res.status(400).json({ error: "Invalid ids" });
  }

  try {
    // must be a member
    const access = await pool.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, req.userId]
    );
    if (access.rowCount === 0) {
      return res.status(403).json({ error: "No access" });
    }

    const q = await pool.query(
      `
      SELECT 
        s.id,
        s.trip_id,
        s.from_user_id,
        fu.full_name AS from_user_name,
        s.to_user_id,
        tu.full_name AS to_user_name,
        s.amount_cents,
        s.currency_code,
        s.created_at
      FROM settlements s
      JOIN users fu ON fu.id = s.from_user_id
      JOIN users tu ON tu.id = s.to_user_id
      WHERE s.id = $1 AND s.trip_id = $2
      `,
      [settlementId, tripId]
    );

    if (q.rowCount === 0) {
      return res.status(404).json({ error: "Settlement not found" });
    }

    return res.json({ settlement: q.rows[0] });
  } catch (e) {
    console.error("[TRIPS] SETTLEMENT DETAIL ERROR:", e);
    return res.status(500).json({ error: "Failed to load settlement" });
  }
});

/*──────────────────────────────────────────────────────────────
  DELETE /trips/:id/settlements/:settlementId
  Delete a settlement (member-only). Anyone in the trip can delete.
──────────────────────────────────────────────────────────────*/
router.delete("/:id/settlements/:settlementId", async (req, res) => {
  const client = await pool.connect();
  try {
    const tripId = Number(req.params.id);
    const settlementId = Number(req.params.settlementId);

    if (!Number.isFinite(tripId) || !Number.isFinite(settlementId)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid ids" });
    }

    await client.query("BEGIN");

    // must be a member
    const access = await client.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, req.userId]
    );
    if (access.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "No access" });
    }

    // ensure settlement belongs to this trip
    const found = await client.query(
      `SELECT id FROM settlements WHERE id = $1 AND trip_id = $2 FOR UPDATE`,
      [settlementId, tripId]
    );
    if (found.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Settlement not found" });
    }

    await client.query(`DELETE FROM settlements WHERE id = $1`, [settlementId]);

    await client.query("COMMIT");
    return res.status(204).send();
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[TRIPS] DELETE SETTLEMENT ERROR:", e);
    return res.status(500).json({ error: "Failed to delete settlement" });
  } finally {
    client.release();
  }
});

export default router;
