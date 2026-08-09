ALTER TABLE "users" ADD COLUMN "number" integer;--> statement-breakpoint
UPDATE "users" AS u SET "number" = s.rn FROM (
	SELECT "id", row_number() OVER (ORDER BY "created_at" ASC, "id" ASC) AS rn FROM "users"
) AS s WHERE u."id" = s."id";--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "users_number_seq" OWNED BY "users"."number";--> statement-breakpoint
SELECT setval('users_number_seq', COALESCE((SELECT MAX("number") FROM "users"), 0) + 1, false);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "number" SET DEFAULT nextval('users_number_seq');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_number_unique" UNIQUE("number");
