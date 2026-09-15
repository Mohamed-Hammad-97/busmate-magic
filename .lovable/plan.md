# Close button on the live tracking window — publish the existing fix

## Diagnosis
The X close button on the tracking window already exists and works in the preview (added earlier in `ParentLiveTracking.tsx`: an X in the top corner hides the trip card, the map stays full-screen and keeps tracking the bus, and a floating button reopens the card). The screenshot is from the published site **seater.org**, which was last published before that change — so the live site simply doesn't have it yet.

## What will change
1. **Publish the app** so seater.org gets the X button (plus everything else built since the last publish).
2. **Small visibility improvement** while we're here: make the X easier to see and tap on phones — slightly larger touch target with a solid contrasting background so it doesn't blend into the card, and make sure it never sits under the notification bell.

## Verification
- After publishing, open seater.org on a phone, go to Tracking with a live trip: the card shows a clear X; tapping it hides the card and the map fills the screen while the bus keeps moving; the floating button brings the card back.
- Confirm the X is tappable and not overlapped by the notification bell on a small screen.
