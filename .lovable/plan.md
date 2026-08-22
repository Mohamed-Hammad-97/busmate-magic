# SEO Favicon & Title Fix

## Goal
Replace the Lovable icon shown in Google search results with the Seater logo, and shorten the page title to just "Seater".

## Current State
- `index.html` title is `Seater — Smart School & Corporate Transportation`.
- `public/favicon.png` exists but is a wide horizontal wordmark; Google search favicon requires a square icon.
- `public/favicon.ico` (the old Lovable/default icon) still exists and may be cached by search engines.
- No `apple-touch-icon` or other favicon sizes are declared.

## Changes

1. **Generate a square Seater brand icon**
   - Use the existing Seater blue wordmark style to create a 512×512 square icon with a transparent or dark background.
   - Downscale it to 64×64 and 180×180 versions for favicon and Apple touch icon.

2. **Replace favicon assets**
   - Overwrite `public/favicon.png` with the square 64×64 icon.
   - Add `public/apple-touch-icon.png` (180×180).
   - Delete `public/favicon.ico` so browsers/search engines do not fall back to the old Lovable icon.

3. **Update `index.html` metadata**
   - Change `<title>` to `Seater`.
   - Update `og:title` and `twitter:title` to `Seater`.
   - Keep `og:site_name` as `Seater`.
   - Update JSON-LD `name` fields to `Seater`.
   - Add `<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />`.

4. **Verify `PageSeo.tsx` defaults**
   - Ensure pages using `PageSeo` pass `Seater` as the base title when they want only the brand name.
   - No hardcoded Lovable defaults remain in any title path.

5. **Validation**
   - Check the built `index.html` references the new favicon and no old `.ico` file.
   - Confirm the icon is a square PNG and displays correctly in the browser tab.
