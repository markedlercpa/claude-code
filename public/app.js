/* ── Tax Document Delivery Calendar ──────────────────── */

const MAX_PER_DAY = 5;
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

let currentYear, currentMonth; // 0-indexed month
let availability = {};         // { "YYYY-MM-DD": count }
let selectedDate = null;

// DOM refs
const monthLabel     = document.getElementById("month-label");
const calendarDays   = document.getElementById("calendar-days");
const prevBtn        = document.getElementById("prev-month");
const nextBtn        = document.getElementById("next-month");
const bookingPanel   = document.getElementById("booking-panel");
const bookingForm    = document.getElementById("booking-form");
const selectedLabel  = document.getElementById("selected-date-label");
const slotsRemaining = document.getElementById("slots-remaining");
const formDate       = document.getElementById("form-date");
const cancelBtn      = document.getElementById("cancel-btn");
const submitBtn      = document.getElementById("submit-btn");
const confirmation   = document.getElementById("confirmation");
const confirmDetails = document.getElementById("confirm-details");
const bookAnother    = document.getElementById("book-another");

// ── Init ────────────────────────────────────────────────
function init() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  prevBtn.addEventListener("click", () => navigate(-1));
  nextBtn.addEventListener("click", () => navigate(1));
  cancelBtn.addEventListener("click", closePanel);
  bookingForm.addEventListener("submit", handleSubmit);
  bookAnother.addEventListener("click", resetAll);
  renderMonth();
}

// ── Navigation ──────────────────────────────────────────
function navigate(delta) {
  currentMonth += delta;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0)  { currentMonth = 11; currentYear--; }
  closePanel();
  renderMonth();
}

// ── Fetch & Render ──────────────────────────────────────
async function renderMonth() {
  const ym = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  monthLabel.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  try {
    const res = await fetch(`/api/availability?month=${ym}`);
    availability = await res.json();
  } catch {
    availability = {};
  }

  renderDays();
}

function renderDays() {
  calendarDays.innerHTML = "";
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  // Empty leading cells
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement("div");
    el.className = "day-cell empty";
    calendarDays.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const count = availability[dateStr] ?? 0;
    const remaining = MAX_PER_DAY - count;
    const isPast = dateStr < today;

    const el = document.createElement("div");
    el.className = "day-cell";

    if (isPast) {
      el.classList.add("disabled");
    } else if (remaining <= 0) {
      el.classList.add("full");
    } else if (remaining <= 2) {
      el.classList.add("limited");
    } else {
      el.classList.add("available");
    }

    el.innerHTML = `<span>${d}</span>`;
    if (!isPast && remaining > 0) {
      el.innerHTML += `<span class="slots">${remaining} left</span>`;
    } else if (!isPast && remaining <= 0) {
      el.innerHTML += `<span class="slots">Full</span>`;
    }

    if (selectedDate === dateStr) el.classList.add("selected");

    if (!isPast && remaining > 0) {
      el.addEventListener("click", () => selectDate(dateStr, remaining));
    }

    calendarDays.appendChild(el);
  }
}

// ── Date Selection ──────────────────────────────────────
function selectDate(dateStr, remaining) {
  selectedDate = dateStr;
  formDate.value = dateStr;

  const d = new Date(dateStr + "T12:00:00");
  selectedLabel.textContent = d.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  slotsRemaining.textContent = `${remaining} of ${MAX_PER_DAY} slots remaining`;
  slotsRemaining.className = "slots-badge " + (remaining <= 2 ? "yellow" : "green");

  confirmation.classList.add("hidden");
  bookingPanel.classList.remove("hidden");
  bookingPanel.scrollIntoView({ behavior: "smooth", block: "start" });

  renderDays(); // refresh selection highlight
}

function closePanel() {
  selectedDate = null;
  bookingPanel.classList.add("hidden");
  bookingForm.reset();
  renderDays();
}

// ── Form Submit ─────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = "Booking...";

  const payload = {
    clientName:  document.getElementById("clientName").value.trim(),
    clientEmail: document.getElementById("clientEmail").value.trim(),
    clientPhone: document.getElementById("clientPhone").value.trim(),
    companyName: document.getElementById("companyName").value.trim(),
    date:        formDate.value,
    taxYear:     document.getElementById("taxYear").value,
    notes:       document.getElementById("notes").value.trim(),
  };

  try {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Booking failed. Please try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Confirm Booking";
      return;
    }

    // Show confirmation
    const d = new Date(payload.date + "T12:00:00");
    confirmDetails.textContent =
      `${payload.clientName}, your tax document delivery is scheduled for ` +
      d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) +
      `. A work item has been created in our system. We'll be in touch at ${payload.clientEmail}.`;

    bookingPanel.classList.add("hidden");
    confirmation.classList.remove("hidden");
    confirmation.scrollIntoView({ behavior: "smooth" });

    selectedDate = null;
    bookingForm.reset();
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirm Booking";

    // Refresh availability
    await renderMonth();

  } catch (err) {
    alert("Network error. Please try again.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirm Booking";
  }
}

// ── Reset ───────────────────────────────────────────────
function resetAll() {
  confirmation.classList.add("hidden");
  bookingPanel.classList.add("hidden");
  selectedDate = null;
  renderMonth();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Go ──────────────────────────────────────────────────
init();
