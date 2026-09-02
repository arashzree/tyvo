-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('owner', 'approver');

-- AlterTable
-- NOTE: no default is provided (matches schema.prisma, which has no @default
-- on `role`), so if any admin_whitelist rows already exist in the target
-- database, this ALTER TABLE will fail until every existing row is given a
-- role. On a brand-new/empty database (the situation described in
-- HANDOFF.md) this runs cleanly.
ALTER TABLE "admin_whitelist" ADD COLUMN "role" "AdminRole" NOT NULL;
