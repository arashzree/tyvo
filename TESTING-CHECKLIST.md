# Tyvo Hero — Real Device Test Checklist

For: whoever is testing the live preview on a real phone/laptop once it's deployed.
No technical background needed — just follow each step and note what you see.

For each item: note **Pass**, **Fail**, or **Not sure** — and if Fail, a one-line
description of what happened instead ("nothing moved," "page went blank,"
"it froze," etc.) is more useful to us than "it didn't work."

---

## Before you start

- [ ] Open the browser console once, before doing anything else, and leave it
  open in the background if you can (see "If something looks wrong" below
  for how). You don't need to read it — just having it open means any
  errors get captured for us automatically as you test.
- [ ] Note the device and browser you're testing on (e.g., "iPhone 13, Safari"
  or "Samsung Galaxy S22, Chrome"). Performance and bugs can be very
  device-specific, so this matters.

## 1. Does the Hero scene load at all?

- [ ] Open the site. Within 2-3 seconds, do you see 3D shapes ("monoliths")
  arranged in a row, with lighting and shadows — not a blank black screen,
  not a broken/frozen image?
  **Pass looks like:** a row of dark, angular pillar-like shapes, one lit
  up more than the others, sitting on a floor with visible shadows.
  **Known-risky area:** older phones or older browsers may fail to load
  the 3D scene entirely (blank/black screen) — this is a real possibility
  worth specifically checking for, not just an edge case.

## 2. Horizontal navigation — swipe (phone) / drag (trackpad or mouse)

- [ ] On a **phone**: swipe left and right across the Hero area.
- [ ] On a **laptop**: click and drag left/right across the Hero area, and
  separately try a two-finger trackpad swipe left/right.
  **Pass looks like:** the row of shapes visibly slides/pans as you
  swipe or drag, smoothly following your finger/cursor — not jumping in
  big steps, not moving the whole page, not scrolling the browser itself.
  **Known-risky area:** drag sensitivity — note if it feels too twitchy
  (tiny movement = huge pan) or too sluggish (big swipe = barely moves).

## 3. Active object emphasis

- [ ] As you pan, does one shape near the center stand out clearly from
  the others (bigger, closer, more lit up)?
  **Pass looks like:** exactly one shape is obviously "in focus" at any
  time, and this changes smoothly as you pan to the next one.

## 4. Tap-to-enter a section

- [ ] Tap/click the centered, active shape.
  **Pass looks like:** the page smoothly scrolls down into a content
  section (text and a heading appear) within about 1-2 seconds.
- [ ] Repeat this for **at least 3 different shapes** as you pan through
  the row, not just the first one you land on.
- [ ] Specifically try tapping the shape that's the odd one out — if a
  small text notice appears near the bottom saying something isn't
  connected yet instead of navigating, that's expected for exactly
  **one** of the 7 shapes right now — not a bug. Note which one it was.

## 5. Normal scrolling after entering a section

- [ ] After tapping into a section, scroll down normally (regular
  finger-scroll or mouse wheel — not swiping sideways).
  **Pass looks like:** the rest of the site behaves like an ordinary
  webpage — vertical scroll only, no sideways movement, no snapping
  back up to the Hero.

## 6. Performance — the FPS number

- [ ] Look at the small number in the corner of the Hero labeled "fps."
  Watch it for about 15 seconds while you pan around.
  **Write down the number(s) you see** — e.g., "mostly 55-60," or
  "drops to 20 when I swipe fast." Green text is good, yellow is
  borderline, red means it's struggling — but the actual number
  matters more than the color.

## 7. Language switch

- [ ] Tap the language toggle (top corner). Does the Hero still work the
  same way (swipe/drag/tap) after switching, and does the text direction
  flip correctly (English left-to-right, Persian right-to-left)?

---

## If something looks wrong

If any step fails, the single most useful thing you can send back is the
browser console output, if you're able to get it:

- **iPhone Safari:** Settings → Safari → Advanced → turn on Web Inspector,
  then connect to a Mac to view console output (needs a computer — if
  that's not available, just describe what happened instead, that's fine).
- **Android Chrome:** visit `chrome://inspect` on a desktop Chrome browser
  with the phone connected via USB.
- **Laptop (any browser):** right-click the page → Inspect → Console tab.
  Copy any red error text you see.

If none of that is accessible, a plain description of what happened
("screen went black after I swiped," "page froze," "nothing happened when
I tapped") is still genuinely useful — don't let the console step block you
from reporting the rest.

## Report back in this format

For each of the 7 numbered sections above: Pass / Fail / Not sure, plus
the device/browser used, plus the FPS numbers from step 6, plus any
console errors or plain-language descriptions of failures.
