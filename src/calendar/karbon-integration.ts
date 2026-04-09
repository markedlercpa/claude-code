import { createWorkItem, addNote } from "../karbon/client.js";
import type { Booking } from "./store.js";
import { updateBookingKarbonKey } from "./store.js";

/**
 * Creates a Karbon work item for a tax document delivery booking
 * and attaches a note with the client's details.
 */
export async function createKarbonWorkItemForBooking(
  booking: Booking,
): Promise<{ ok: boolean; workItemKey?: string; error?: string }> {
  const title = `Tax Return – ${booking.companyName || booking.clientName} – TY${booking.taxYear}`;

  const res = await createWorkItem({
    Title: title,
    Description: `Client ${booking.clientName} scheduled tax document delivery for ${booking.date}.`,
    StartDate: new Date().toISOString().slice(0, 10),
    DueDate: booking.date,
  });

  if (!res.ok) {
    console.error("Karbon createWorkItem failed:", res.status, res.data);
    return { ok: false, error: `Karbon API error ${res.status}` };
  }

  const workItemKey = res.data.WorkItemKey;

  // Attach a note with full booking details
  const noteBody = [
    `**Tax Document Delivery Scheduled**`,
    `- **Client:** ${booking.clientName}`,
    `- **Email:** ${booking.clientEmail}`,
    booking.clientPhone ? `- **Phone:** ${booking.clientPhone}` : null,
    booking.companyName ? `- **Company:** ${booking.companyName}` : null,
    `- **Delivery Date:** ${booking.date}`,
    `- **Tax Year:** ${booking.taxYear}`,
    booking.notes ? `- **Notes:** ${booking.notes}` : null,
    ``,
    `Booked via Tax Calendar on ${booking.createdAt}.`,
  ]
    .filter(Boolean)
    .join("\n");

  await addNote(workItemKey, noteBody);

  // Link the Karbon work item back to the booking
  updateBookingKarbonKey(booking.id, workItemKey);

  return { ok: true, workItemKey };
}
