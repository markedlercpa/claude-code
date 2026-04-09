import express from "express";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addBooking,
  getAvailabilityForMonth,
  getCountForDate,
} from "./store.js";
import { createKarbonWorkItemForBooking } from "./karbon-integration.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "../../public");
const PORT = Number(process.env.CALENDAR_PORT ?? 3001);

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// ── API Routes ─────────────────────────────────────────────

/** GET /api/availability?month=YYYY-MM  →  { "2026-04-10": 3, … } */
app.get("/api/availability", (req, res) => {
  const month = req.query.month as string | undefined;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: "month query param required (YYYY-MM)" });
    return;
  }
  res.json(getAvailabilityForMonth(month));
});

/** POST /api/bookings  →  create booking + Karbon work item */
app.post("/api/bookings", async (req, res) => {
  const { clientName, clientEmail, clientPhone, companyName, date, taxYear, notes } =
    req.body ?? {};

  // Validate required fields
  if (!clientName || !clientEmail || !date || !taxYear) {
    res.status(400).json({ error: "clientName, clientEmail, date, and taxYear are required." });
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD format." });
    return;
  }

  // Check if date is in the past
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) {
    res.status(400).json({ error: "Cannot book a date in the past." });
    return;
  }

  // Check availability before attempting to add
  const currentCount = getCountForDate(date);
  if (currentCount >= 5) {
    res.status(409).json({
      error: "That date is fully booked (5 returns max per day). Please choose another date.",
    });
    return;
  }

  const result = addBooking({
    clientName,
    clientEmail,
    clientPhone: clientPhone ?? "",
    companyName: companyName ?? "",
    date,
    taxYear,
    notes: notes ?? "",
  });

  if (!result.ok) {
    res.status(409).json({ error: result.reason });
    return;
  }

  // Fire-and-forget Karbon integration (don't block the client response)
  createKarbonWorkItemForBooking(result.booking).catch((err) =>
    console.error("Karbon integration error:", err),
  );

  res.status(201).json({
    message: "Booking confirmed!",
    booking: {
      id: result.booking.id,
      date: result.booking.date,
      clientName: result.booking.clientName,
    },
  });
});

// ── Start Server ───────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Tax Calendar running at http://localhost:${PORT}`);
});
