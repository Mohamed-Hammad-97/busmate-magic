# Captain contact on the trip screen + daily line cancellations

## 1. Captain details card (customer trip screen)

- Show the captain's phone number under his name, with a blue call button that opens the phone dialer.
- Always show the car plate row. If no plate is saved, show "Not added yet" (لم تُضف بعد). The current captain, Moustafa, has no plate saved, which is why it does not show today. Staff can add it from the driver's profile.

## 2. Cancellation flow

### Cancellation deadline, chosen per trip by staff

When staff create or edit a trip, they pick one of 3 options:

- **Until 1 hour before departure**
- **Until 2 hours before departure** (default)
- no cancel

### Customer cancels

- A "Cancel booking" (إلغاء الحجز) button appears on upcoming booking cards in the portal and on the trip screen.
- It only works if the booking is **not paid** and the trip has **not started**, and the trip's deadline has not passed. Otherwise the button is hidden, with a short note: "Paid bookings: contact support to cancel" or "Cancellation window closed".
- A confirmation asks before cancelling. Afterwards the booking shows "Cancelled", its seat is freed, and the booking moves to History.

### Staff cancel a single booking

- In the Daily Lines admin bookings list, a "Cancel" action works on any booking, paid or not, with no time limit.

### Staff cancel a whole trip

- A "Cancel trip" action on each trip, with a confirmation. The trip and all its bookings become Cancelled, and customers see "Trip cancelled" on their cards.

## Technical details

- Migration: `daily_line_trips.cancel_cutoff_hours smallint NOT NULL DEFAULT 2` (allowed values 1 or 2). Add `cancelled_at timestamptz` and `cancelled_by text` ('customer' or 'staff') on `daily_line_bookings`.
- New security-definer RPC `cancel_daily_line_booking(_booking_id)`. It checks that the caller owns the booking (`get_user_parent_ids`), that `payment_status = 'pending'`, that the trip status is `scheduled`, and that `now() < trip_date + departure_time (Cairo) - cutoff`. It then sets the booking to `cancelled`. The existing `daily_line_update_seats` trigger frees the seat. Employees can cancel any booking.
- Staff whole-trip cancel: an RPC that sets the trip to `cancelled` and cancels all its non-cancelled bookings (employees with the operations daily lines role or super admin).
- UI: `DailyLineTripTracking.tsx` (captain card plus cancel button), `DailyLinePortal.tsx` (cancel on upcoming cards), and the daily lines admin trips/bookings screens (cutoff picker, cancel booking, cancel trip).
- A unit test for the cutoff rule (for example, a 17:00 trip with a 2-hour cutoff can be cancelled at 14:59 but not at 15:01).