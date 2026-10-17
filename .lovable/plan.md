# Fuller trip cards and "Missed" status in the customer Daily Lines portal

## What the customer will see

### History cards
Each past trip card shows:
- Line name and city
- Pickup station and drop-off station, with their estimated times
- Trip date and departure time, plus actual boarding and drop-off times when recorded
- Price paid, payment method (Cash / Instapay) and any promo discount
- A clear trip result badge:
  - **Completed** (أكملت الرحلة) — he boarded / was dropped off
  - **Missed** (لم يتم الركوب) — the trip finished and he never boarded
  - **Cancelled** (ملغاة) — the trip or booking was cancelled

A missed trip no longer shows "Pending" (قيد الانتظار).

### Payment tab cards
Same details as the history cards (line, stations with times, date and time, price, method, discount). For a missed trip the status shows **Missed** instead of Pending, and the Instapay receipt upload button is hidden. Paid and Cancelled stay as today; upcoming unpaid trips still show Pending with the receipt button.

## Rule
A booking is "Missed" when the trip is completed and the customer has no boarding time and no drop-off time, and the booking is not paid or cancelled.

## Technical details
- Only `src/pages/DailyLinePortal.tsx` changes; no database changes.
- Add a `getBookingOutcome(b)` helper (completed / missed / cancelled / upcoming) based on `daily_line_trips.status`, `boarded_at`, `dropped_at`, `payment_status`.
- `BookingCard` compact mode stops hiding the stations row and adds price/method/discount and boarded/dropped times; the status badge uses the outcome (Missed replaces Pending).
- Payments tab cards reuse the same detail block and outcome badge; receipt upload only for upcoming pending Instapay bookings.
- Ensure the bookings query selects `boarded_at`, `dropped_at`, `discount_amount`, and pickup/dropoff `minutes_from_start`.
- Add a small unit test for the Missed rule.
