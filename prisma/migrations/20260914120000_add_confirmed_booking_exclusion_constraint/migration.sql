-- docs/AUDIT.md finding #5: DB-level backstop for the confirm-race window.
--
-- handleConfirm (netlify/functions/telegram-webhook.js) re-checks the slot
-- is free of other CONFIRMED bookings before writing status='confirmed' --
-- but that's a read-then-write, not atomic. Two near-simultaneous confirms
-- (a double-tap, or two different pending requests for an overlapping slot
-- both getting confirmed within the race window) can both pass the read
-- before either write lands, producing two CONFIRMED bookings that overlap.
--
-- Uses an EXCLUDE constraint rather than a plain unique index on
-- (space_id, start_at): start_at is not currently validated server-side to
-- align to the fixed TIME_SLOTS grid (POST /api/bookings accepts any
-- timestamp satisfying the lead-time check), so two confirmed bookings
-- could in principle overlap without having an identical start_at (e.g.
-- 14:00-15:00 and 14:30-15:30). A plain unique index would miss that; this
-- constraint catches any real overlap, exact-start-match or not.
--
-- tsrange (not tstzrange) because start_at/end_at are TIMESTAMP(3) --
-- timestamp without time zone (see schema.prisma). Default range bounds
-- are '[)' (inclusive lower, exclusive upper), which is exactly the
-- semantics lib/availability.js's overlaps()/isSlotFree() already use --
-- back-to-back bookings (10:00-11:00 and 11:00-12:00) are NOT an overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap_confirmed"
  EXCLUDE USING gist (
    "space_id" WITH =,
    tsrange("start_at", "end_at") WITH &&
  )
  WHERE (status = 'confirmed'::"BookingStatus");
