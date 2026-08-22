# Contracts & Rules Signing for Parents

Each parent must read, accept and sign the Seater rules contract — one contract per child (per subscription). Unsigned contracts are shown as a blocking step right after login.

## What the parent sees

1. After logging in, if any of their children has an active subscription with an unsigned contract, a full-screen dialog opens: "عقد وقواعد الاشتراك" — one contract per child, shown one after another (e.g. 2 children = 2 contracts).
2. The contract body is rendered as styled Arabic text (not a PDF image), reproducing the attached rules exactly:
   - Section A: التزامات الشركة (14 items)
   - Section B: التزامات ولي الأمر (10 items)
   - Section C: a filled-in subscription table — اسم الطالب، المدرسة، القسم التعليمي، نوع السيارة، قيمة التأمين، قيمة الاشتراك السنوي، عدد الدفعات، and each installment row (رقم الدفعة / قيمة الدفعة / موعد الاستحقاق) pulled live from that child's subscription and payments.
   - The fuel-price note and company contact footer.
3. Below the text: a checkbox "لقد قرأت ووافقت على القواعد والالتزامات"، a signature field where the parent types their full name، and an "أوافق وأوقع" button (disabled until both are filled). Scroll-to-bottom is required before the button enables.
4. The parent can skip the dialog only if no subscription is complete; otherwise it stays until all contracts are signed (a "لاحقاً" close is available but the dialog reappears each visit and a red banner stays on the dashboard).
5. A new "العقود" tab in the parent dashboard lists all contracts (signed / pending), with a view + print action for signed ones showing the acceptance date and signature name.

## Staff side

In the registration details view, a small badge shows whether the parent signed the contract, with the signature name and timestamp.

## Technical notes

- New table `public.contract_acceptances`: `registration_id`, `subscription_id`, `parent_id`, `contract_version` (text, e.g. `cairo-25-26`), `signature_name`, `accepted_at`, `snapshot` (jsonb copy of the subscription/installment values at signing time), timestamps. Unique on (registration_id, contract_version).
- Grants + RLS: parents can read/insert their own rows (via `get_user_parent_ids`), no update/delete; employees and super admins can read; `service_role` full.
- Contract text lives in a single source file `src/lib/contractText.ts` so future versions can be added without touching UI.
- New components: `src/components/parent/ContractDialog.tsx` (renders one contract + signing controls) and `src/components/parent/ContractsTab.tsx` (list/print). Wired into `src/pages/ParentDashboard.tsx`, gated on registrations with `status = 'complete'` and an existing subscription.
- Printing uses a print-styled view of the same component; no PDF library added.
