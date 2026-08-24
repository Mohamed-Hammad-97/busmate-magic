# Driver & Supervisor Portal: Back Button, Parent Phone Choice, Students List

## 1. Back arrow in trip tracking
The trip tracking screen opens as a full-screen dialog with no visible way back other than the dialog's default close.

- Add a back arrow button at the start of the trip header in `DriverTripInterface`, calling the existing `onClose` prop.
- Arrow direction follows the app language (RTL/LTR aware).

## 2. Call father or mother
Today only the father's phone is shown and dialed.

- Fetch `mother_phone` alongside `father_phone` for each student on the trip.
- In the student list row, the phone icon opens a small menu with "Father" and "Mother" options (only shown when the number exists); a single number dials directly.
- In the student detail dialog, show both numbers as separate call rows (father, mother) plus the pickup address text.

## 3. New "Students" tab in the driver/supervisor portal
Add a tab (visible in the portal for both supervisors and drivers) listing all students on their assigned line(s).

Per student card:
- Student name and grade
- Parent name
- Father phone (call button) and mother phone (call button)
- Pickup address text, with an "open in maps" link

If the account has more than one route, a route selector at the top; otherwise the single route loads directly. Includes a search box by student or parent name.

## Technical notes
- `src/hooks/useLiveTrip.ts`: extend the `trip_student_status` select and the `TripStudentStatus` type with `mother_phone` and `pickup_address` from `parent_accounts`; also pull `registrations.grade`.
- `src/components/tracking/DriverTripInterface.tsx`: back button wired to `onClose`; replace the single `tel:` link with a dropdown when both numbers exist; extend the student dialog.
- New `src/components/tracking/DriverStudentsList.tsx`: queries `route_assignments` joined to `registrations` + `parent_accounts` for the selected route, excluding cancelled registrations.
- `src/pages/DriverDashboard.tsx`: add the "Students" tab and render the new component.
- Bilingual strings added to `src/i18n/index.ts` under `driverPortal`.
- No database or RLS changes: drivers/supervisors already read their route's registrations and parent accounts through existing policies.
