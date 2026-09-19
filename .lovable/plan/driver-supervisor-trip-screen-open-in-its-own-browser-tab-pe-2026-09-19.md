# Driver/Supervisor trip screen: open in its own browser tab, perfect on phones

## What you asked
1. Tapping "بدء الرحلة" / "متابعة الرحلة" in the driver/supervisor portal must open the trip in a **new browser tab** (its own page with its own address), not inside a popup window on the dashboard.
2. The trip page must be **perfect on phones** — that's the main device for drivers and supervisors.

## Why it works
Driver login sessions are stored in the browser (standard auth storage), so a newly opened tab is already signed in — no re-login needed.

## Changes

### 1. New trip page (`/driver/trip/:routeId`)
- Add route `trip/:routeId` under `/driver/*` in `src/App.tsx`, wrapped in `DriverProtectedRoute` + `GoogleMapsProvider`, rendering `DriverTripInterface` as a full page.
- Not signed in → redirected to `/driver/login`, then returns to the trip after login.

### 2. Dashboard opens a new tab (`src/pages/DriverDashboard.tsx`)
- Start/Continue trip buttons and the "active trip" banner now call `window.open('/driver/trip/<id>', '_blank')` instead of opening the dialog.
- Remove the dialog wrapper, `selectedRouteId` state, and dialog imports.
- Dashboard keeps refreshing active trips, so when the driver comes back to the first tab it shows the trip as active/finished.

### 3. Phone-perfect trip page (`src/components/tracking/DriverTripInterface.tsx`)
- Remove the forced `min-w-[640px]` (the leftover that required sideways scrolling) — the page fits every screen width with no horizontal scrolling.
- Full-screen layout: natural page scroll up/down; sticky header stays on top (route name + start/end trip button always visible).
- Map height responsive: taller on phones (~45% of screen height), capped on desktop.
- Student list uses normal page scroll instead of a nested scroll box, so thumb scrolling is smooth on phones.
- Bigger touch targets for student cards and call buttons; the floating red "إنهاء الرحلة" button stays reachable above the thumb zone.
- On this standalone page, the back arrow navigates back to `/driver` (dashboard) instead of closing a dialog.
- Everything else (live GPS sending, student status buttons, absence flags, call parents dropdown) works exactly as today.

### 4. No other behavior changes
- Login flow, coverage permissions, notifications, and tracking logic are untouched.

## Verification
- Build passes; Playwright check on a phone-sized viewport: open trip page directly, confirm no horizontal scroll, header sticky, buttons tappable.
