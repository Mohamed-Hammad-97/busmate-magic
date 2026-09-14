# Add close button to parent tracking overlay so the map stays visible

## What's requested
In the parent portal Tracking tab, the live-trip details overlay currently covers the map and has no way to close it. Parents want an **X** button on that overlay so they can dismiss it, keep the map full-screen, and still watch the bus move live.

## What will change

1. **`src/components/tracking/ParentLiveTracking.tsx`**
   - Add local state `showPanel` (default `true`).
   - Add a close (X) button in the top-right corner of the floating overlay card.
   - When the panel is closed:
     - Hide the overlay card completely.
     - Keep the map container full height and the `<LiveTripMap />` rendering with the current trip and student statuses so GPS updates continue.
     - Show a small floating "Show trip details" button so the parent can reopen the overlay without leaving the page.
   - Ensure the close/reopen buttons work in both LTR and RTL layouts and are accessible with `aria-label`.

2. **No backend or data changes**
   - Live queries, realtime subscriptions, and GPS polling remain unchanged; only the panel visibility toggles.

## Verification
- Open the parent portal Tracking tab with an active trip.
- Click **X**: the overlay disappears and the map fills the available space; the bus marker still updates as the driver moves.
- Click the floating button: the overlay returns with all trip/driver/student data intact.
- Check on mobile width: close/reopen buttons are tappable and do not overlap the notification bell or map controls.
