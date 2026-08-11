# Choose the school when moving an "Other" registration

Today, clicking "Move to registrations" instantly creates a school from whatever the parent typed. Replace that confirmation box with a proper dialog where the employee picks the real school first.

## New dialog

When the employee clicks the move action on a record in the Other Registrations tab, a dialog opens showing:

- A read-only reminder of what the parent wrote (school name + address) so the employee knows what to match.
- A searchable dropdown of existing active schools in the record's city (with a toggle to show all cities).
- An option "Create a new school" that pre-fills the name from the parent's entry, and lets the employee edit the name, city and pick the location on the map before creating it.
- Confirm button, disabled until a school is selected or a valid new school is filled in.

## What happens on confirm

- The registration is created against the selected (or newly created) school; the parent's free-text school name/address is no longer used to auto-create schools.
- The parent account is created or reused as it is today, and the original record is marked converted.
- The parent's typed school name and address are cleared from the record once it's moved, so the leftover text doesn't linger.

## Technical notes

- Edit `src/components/registrations/OtherRegistrations.tsx`: replace the `AlertDialog` confirm with a new `ConvertToRegistrationDialog` component (new file under `src/components/registrations/`).
- Dialog fetches `schools` (id, name, city, is_active) and filters client-side by the record's city with a "show all" switch; reuse `LocationPickerMap` for the new-school coordinates.
- `convertMutation` takes `{ rec, schoolId }` instead of resolving the school itself; new-school creation happens in the dialog before confirming, or inside the mutation when a new school payload is passed.
- Step 4 update on `other_registrations` also sets `school_name` to the chosen school's name and clears `school_address`, `school_latitude`, `school_longitude`.
