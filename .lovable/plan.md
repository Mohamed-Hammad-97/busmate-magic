# Full bilingual customer portal (EN / AR)

Make every screen of the customer portal follow the app's selected language instead of showing hardcoded Arabic.

## What changes for the parent

- A language switcher (EN / AR) in the customer portal header, matching the one already used on the public site.
- Switching to English translates the whole portal: navigation, dashboard, kids, routes, payments, absences, contracts and messages — including buttons, empty states, badges, dialogs and toast notifications.
- Layout flips correctly between right-to-left (Arabic) and left-to-right (English), as it already does elsewhere in the app.
- The rules/contract legal document itself stays in Arabic in both languages (as agreed); only the surrounding interface, buttons and status labels translate.

## Scope of screens

1. Dashboard overview (summary cards, current route status, next payment, alerts)
2. My Kids
3. Routes (line number, bus type, plate, driver/supervisor cards)
4. Payments (child cards, totals, installment list, insurance/instalment labels, Fawry code, receipt actions, "payment plan not activated yet" state)
5. Absences (form, date picker, reason, list of registered absences, toasts)
6. Contracts (list, signed/unsigned badges, sign dialog, checkbox, signature name, confirmation toasts)
7. Messages (new-chat picker: Customer Service / Supervisor / Line group, read-only lock notice, input placeholder, timestamps, empty states)
8. Live trip tracking screen for daily-line bookings

## Technical notes

- All strings move into the existing `parentPortal` namespace in `src/i18n/index.ts`, with matching `en` and `ar` entries; new sub-groups added for `absences`, `contracts`, `messages`, and payment detail labels.
- Components converted to `useTranslation()`: `src/pages/ParentDashboard.tsx` (remaining hardcoded strings), `src/components/parent/AbsenceRegistration.tsx`, `ContractsTab.tsx`, `ContractDialog.tsx`, `ContractDocument.tsx` (chrome only), `src/components/chat/ParentChat.tsx`, `src/pages/DailyLineTripTracking.tsx`, and the portal tab definitions/nav labels.
- Ordinal installment labels ("القسط الأول" / "التأمين") become translated helpers with English equivalents ("Installment 1", "Insurance").
- Dates and currency formatted per active locale (`ar-EG` / `en-GB`), currency shown as `EGP` / `ج.م`.
- `LanguageSwitcher` added to the portal header; the choice persists via the existing i18next language detector, and `DirectionManager` keeps handling `dir`/`lang`.
- `src/lib/contractText.ts` is left unchanged (Arabic legal text preserved).

No backend, data, or permission changes.
