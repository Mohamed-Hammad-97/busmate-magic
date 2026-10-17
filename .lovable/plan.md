# Back button label + silent super-admin view of company data

## 1. Back buttons say "Back" / "رجوع"
Some back buttons show the raw text "common.back" because that label was never added. Add it in English ("Back") and Arabic ("رجوع") so every back arrow reads correctly (daily line registration, payment reminder details, and any other screen using it).

## 2. Super admin sees all company data, silently

Suggested workflow:

```text
Corporate page (super admin)
  -> open a company
     -> new tab "Employee Registrations"
        - all employees who signed up (pending + approved), line or custom pickup, map location, date
        - filter by status / line, search by name or phone, export to Excel
     -> button "View company portal as admin" (super admin only)
        - opens a read-only copy of that company's portal (dashboard, employees,
          lines, attendance, invoices, messages, accounts)
        - yellow banner "Admin view - read only"; nothing can be changed
```

Silence guarantees:
- No notification, message, "last seen" or read-receipt is created for the company; viewing messages does not mark them read.
- No login is made on the company's accounts and their sessions are untouched.
- The company's activity/accounts lists never show the super admin.
- Every admin view is recorded only in Seater's internal access log (visible to super admins), for accountability.

Only super admins get this; Operations (Companies) keep their current access.

## Technical details
- `src/i18n/index.ts`: add `common.back` to EN and AR.
- New `CompanyRegistrationsTab` in `CompanyDetailView.tsx` reading `company_employees` (existing staff RLS; verify super admin SELECT, add policy if missing).
- `company-portal-data` edge function: accept an employee bearer token, verify `has_role(super_admin)`, force read-only (reject all write actions, skip `company_notifications` inserts and read-state updates), log to `sensitive_data_access_log`.
- New route `/corporate/:companyId/portal-view` rendering `CompanyDashboard` in read-only mode with the banner, data fetched via the admin path.
