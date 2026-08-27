-- 0041_mail_i18n_manual.sql
-- Idempotent — safe to paste into the Neon SQL editor or psql, and safe to
-- re-run. Lets a system mail carry translation keys instead of a frozen string:
-- subject/body keep an English fallback for the admin panel and older clients,
-- while the client renders subject_key/body_key with body_vars in the player's
-- own language. Player-to-player mail leaves all three columns NULL.

ALTER TABLE "mail_messages" ADD COLUMN IF NOT EXISTS "subject_key" varchar(80);
ALTER TABLE "mail_messages" ADD COLUMN IF NOT EXISTS "body_key" varchar(80);
ALTER TABLE "mail_messages" ADD COLUMN IF NOT EXISTS "body_vars" jsonb;
