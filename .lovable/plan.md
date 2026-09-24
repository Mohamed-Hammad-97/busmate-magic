# Fix parent live bus tracking

## Goal
Make the supervisor’s bus reliably appear and move on the parent tracking map, refreshing every 3 seconds, and hide the drawn home-to-school route while a trip is active.

## Plan
1. **Make supervisor location delivery reliable**
   - Send each accepted GPS position through an authenticated trip-location endpoint instead of relying only on a direct browser table update.
   - Validate that the signed-in driver/supervisor is assigned to, or covering, the active line before accepting a location.
   - Refresh an expiring trip login and retry once when needed, while preventing overlapping 3-second updates.
   - Show the supervisor a clear retry state if location permission is denied or a location update fails.

2. **Keep the parent map current**
   - Continue polling the active trip every 3 seconds and update the bus marker from the latest saved coordinates.
   - Select the relevant active trip deterministically and preserve the parent’s map position instead of repeatedly resetting the view.
   - Treat zero coordinates safely and display the bus whenever valid coordinates exist.

3. **Remove the active-trip route line for parents only**
   - Add a map option that hides the road/polyline.
   - Disable it in the parent tracking tab while keeping the route and navigation line available in the supervisor/driver trip screen.

4. **Verify the complete flow**
   - Confirm a supervisor’s location reaches the active trip record.
   - Open the matching parent tracking view and verify the bus marker appears and changes after a new coordinate update.
   - Confirm no route line is rendered in the parent view, on phone and desktop sizes.

## Technical details
- Current records show that some active trips receive coordinates every few seconds, while others have stale or missing coordinates. This confirms the parent map can read location fields, but the supervisor-to-trip update path is not reliable for every trip.
- The current supervisor heartbeat writes directly to `live_trips`, while the parent query already refreshes every 3 seconds.
- The shared map always renders its polyline today; this will become an explicit per-view option.
