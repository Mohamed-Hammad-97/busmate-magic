# Give operations access to the school salaries tab

The salaries tab already lives inside School Management, but it is only visible to finance and super admins, and only they can edit it. Operations staff will get the same access.

## What changes

- The المرتبات (Salaries) tab appears in School Management for operations employees as well as finance and super admins.
- Operations can edit monthly cost, absence-deduction override, and record a salary payment — the same actions finance has.
- No other tab or section changes.

## Technical notes

- `src/pages/SchoolManagement.tsx`: replace the `isFinance` gate on the salaries tab with `isFinance || canEdit` (operations or super admin), and pass `canEdit={isFinance || canEdit}` to `SchoolSalaries`.
- Database: `staff_monthly_salaries` already allows any employee to read and write, so no change there. `salary_payments` is finance/super-admin only for writes, so add a migration granting the operations department insert/update access (policy using `has_department(auth.uid(), 'operations')`) so the "record payment" action works for them.
