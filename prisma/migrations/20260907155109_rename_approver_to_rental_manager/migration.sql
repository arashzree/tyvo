-- DataMigration
-- Step 2/10 of docs/ROLE_GAP.md's implementation plan. Renames existing
-- 'approver' admin_whitelist rows to 'rental_manager'. Does not touch
-- the AdminRole enum (already extended additively in the prior
-- migration) — this only updates data. Idempotent: safe to re-run,
-- since after the first run no row matches the WHERE clause.
UPDATE "admin_whitelist" SET "role" = 'rental_manager' WHERE "role" = 'approver';
