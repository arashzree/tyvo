-- AlterEnum
-- Additive only, per docs/ROLE_GAP.md's step-1 plan: adds the two new
-- AdminRole values needed for the three-role model. Does NOT remove or
-- rename 'approver' — that happens at the data/code layer in later steps.
-- Postgres can't drop an enum value without recreating the type, so
-- 'approver' stays in the type indefinitely, unused, once those later
-- steps land.
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'rental_manager';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'member';
