import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";

export interface Booking {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  companyName: string;
  date: string; // YYYY-MM-DD
  taxYear: string;
  notes: string;
  createdAt: string;
  karbonWorkItemKey?: string;
}

interface StoreData {
  bookings: Booking[];
}

const MAX_PER_DAY = 5;

const DATA_PATH = join(
  dirname(new URL(import.meta.url).pathname),
  "../../data/bookings.json",
);

function load(): StoreData {
  if (!existsSync(DATA_PATH)) {
    return { bookings: [] };
  }
  return JSON.parse(readFileSync(DATA_PATH, "utf-8")) as StoreData;
}

function save(data: StoreData): void {
  const dir = dirname(DATA_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

export function getBookingsForDate(date: string): Booking[] {
  return load().bookings.filter((b) => b.date === date);
}

export function getCountForDate(date: string): number {
  return getBookingsForDate(date).length;
}

export function getAvailabilityForMonth(yearMonth: string): Record<string, number> {
  const data = load();
  const counts: Record<string, number> = {};
  for (const b of data.bookings) {
    if (b.date.startsWith(yearMonth)) {
      counts[b.date] = (counts[b.date] ?? 0) + 1;
    }
  }
  return counts;
}

export function addBooking(
  input: Omit<Booking, "id" | "createdAt" | "karbonWorkItemKey">,
): { ok: true; booking: Booking } | { ok: false; reason: string } {
  const data = load();
  const dayCount = data.bookings.filter((b) => b.date === input.date).length;
  if (dayCount >= MAX_PER_DAY) {
    return {
      ok: false,
      reason: `That date is fully booked (${MAX_PER_DAY} returns max per day).`,
    };
  }

  const booking: Booking = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  data.bookings.push(booking);
  save(data);
  return { ok: true, booking };
}

export function updateBookingKarbonKey(
  bookingId: string,
  karbonWorkItemKey: string,
): void {
  const data = load();
  const booking = data.bookings.find((b) => b.id === bookingId);
  if (booking) {
    booking.karbonWorkItemKey = karbonWorkItemKey;
    save(data);
  }
}
