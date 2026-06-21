-- Remove email/password auth: drop columns, restore googleId as required.
-- Safety: delete any email-only accounts (these have no googleId) before re-adding NOT NULL.
DELETE FROM "User" WHERE "googleId" IS NULL;

DROP INDEX IF EXISTS "User_email_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "email";
ALTER TABLE "User" DROP COLUMN IF EXISTS "password";
ALTER TABLE "User" ALTER COLUMN "googleId" SET NOT NULL;
