# 3D microbus like your reference photos

## What you get
- A new white high-roof 14-seat microbus in the style of your photos: long side windows, dark tinted glass, silver wheels, red tail lights.
- It's shown at an angle from above, the same 3D way as the Google Maps car, so you can see the roof, one side and the wheels. It no longer looks like a flat picture taken from straight above.
- Made from your photos as reference, without the Toyota logo or the plate text.

## How it turns on the map
Spinning an angled 3D picture makes it look tipped over, so I'll make it the way Google does:
- Make 8 views of the same bus (facing up, up-right, right, down-right, down, and so on).
- The map shows the view closest to the way the bus is driving.
- The faded look for buses with no signal and the colored ring for the selected bus stay the same.

## Technical details
- Use `imagegen--edit_image` with the uploaded reference photos to make one master angled view, then generate the other headings from it. Save them as transparent PNGs `src/assets/microbus/dir-{0,45,...,315}.png`; if a direction comes out inconsistent, make it by mirroring its opposite side (for example, mirroring 45 gives 315).
- `src/lib/carMarker.ts`: preload the 8 images and pick the one for `round(heading/45)`, with no canvas rotation; keep the faded/ring options and the cache. Every map already uses this helper, so no other screens need changes.
- Remove `src/assets/microbus-3d.png`.
