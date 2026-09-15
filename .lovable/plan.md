# Tracking card: swap the X position and call the supervisor

## What changes

1. **Swap the corners on the live trip card**
   - The X (close) button moves to the opposite corner of the card.
   - The green "LIVE NOW" badge takes the corner where the X used to be.
   - Both stay correctly placed in Arabic (right-to-left) and English layouts, and the X keeps its larger, easy-to-tap size.

2. **"Call Driver" becomes "Call Supervisor"**
   - The green button is relabelled and dials the supervisor of the line instead of the driver.
   - Tapping it opens the phone dialler with the supervisor's number, which asks the phone for permission the normal way.
   - If the line has no supervisor number, the button falls back to the driver so the parent is never left without a contact.
   - The small "Driver" detail above stays as information only.

## Technical notes
- File: `src/components/tracking/ParentLiveTracking.tsx`.
- Supervisor name and phone are already loaded with the trip (`routes.supervisors (full_name, phone)`), so no data or permission changes are needed.
- The X button moves from `right-2` to a start-side placement using logical positioning so it flips with direction; the LIVE badge row is reordered accordingly.
- `tel:` link switches to `currentTrip.routes?.supervisors?.phone ?? currentTrip.routes?.drivers?.phone`, and the button block renders whenever either number exists.

## Verification
Open the customer portal Tracking tab with a live trip: the X sits in the opposite corner from before with LIVE NOW in its place, and the green button reads "Call Supervisor" and dials the supervisor.
