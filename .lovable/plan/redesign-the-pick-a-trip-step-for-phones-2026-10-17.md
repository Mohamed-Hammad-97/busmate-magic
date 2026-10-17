# Redesign the "Pick a trip" step for phones

## What changes for the customer

1. **Day filter buttons**
   - A row of buttons you can swipe sideways at the top: **All**, then one button for each day that has trips (for example "Sat 19", "Sun 20"). Today is labelled "Today" and tomorrow is labelled "Tomorrow".
   - Tapping a day shows only that day's trips. **All** shows every trip, grouped under day headings.
   - Days with no trips are not shown. The selected day uses Seater blue, and the other days use a light blue outline.
   - Labels appear in Arabic or English, matching the site language.

2. **New trip card (built for phones)**
   - The departure time is large and bold on the left. The day and date are smaller underneath.
   - Prices sit on the right as two small chips, "Cash 35" and "Instapay 35", so nothing wraps onto a second line.
   - Ongoing trips keep a green "جارية الآن · Ongoing" label.
   - The selected card gets a blue border, a soft blue background and a blue check mark. This replaces the orange.
   - The large round seat bubble that overflows the card is removed.

3. **Seats label only when seats are running out**
   - Hidden normally. It appears only when 4 or fewer seats are left.
   - It shows as a small warm chip: "باقي 3 مقاعد فقط · Only 3 seats left". It reads "مقعد واحد · 1 seat left" when one seat is left.

4. **More Seater blue on the booking pages**
   - The progress bar, the "Daily Line Trip" badge, the Next button and the selected states change from orange/amber to Seater blue across all booking steps.
   - The page background tint becomes a soft blue.
   - Orange is kept only for the low-seats warning, so it stands out.

## Technical details

- Only `src/pages/RegisterDailyLine.tsx` changes. No changes to the database or booking rules.
- New state `dayFilter` ('all' | 'YYYY-MM-DD'). The day buttons come from the unique `trip_date` values in the trip list, which is already filtered. Choosing a new line resets the filter to 'all'.
- If the filter hides the selected trip, the trip is unselected.
- Colors use the existing `primary` design token instead of hardcoded orange/amber gradients. The low-seats chip uses a warning style.
- Check the layout at 390x844 with Playwright after building.
