# Show the captain's licence number as the car plate

The captain card on the customer's trip screen currently reads a separate, empty "vehicle plate" field, so it shows "Not added yet". The licence number already saved on each driver's record is the car plate, so the card should use it.

## Change
- In the customer trip tracking screen, load the driver's licence number with the other captain details.
- The "رقم اللوحة (Car plate)" row shows the licence number. If it is empty, fall back to the old plate field, then "لم تُضف بعد (Not added yet)".
- No data changes and nothing changes on staff screens.

## Technical details
- `src/pages/DailyLineTripTracking.tsx`: add `license_number` to the drivers select (line 84) and display `driver.license_number || driver.vehicle_plate || fallback` (line 367).
- Check that customers can read this column under the current access rules. If the select fails for customers, return it through the same path that already provides the phone and plate.
