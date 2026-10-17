# Make the company add/edit window scrollable

## What changes
- The single window used for both "Add new company" and "Edit company" will scroll up and down when its content is taller than the screen, so every field and the save button stay reachable on phones and small screens.
- On phones, the two-column fields will stack into one column for easier use.

## Technical details
- `src/pages/Corporate.tsx`: add `max-h-[90vh] overflow-y-auto` to the company `DialogContent` (same pattern as other corporate dialogs), and change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` inside it.

## Verification
- Open add and edit company at phone size and confirm scrolling reaches the save button.
