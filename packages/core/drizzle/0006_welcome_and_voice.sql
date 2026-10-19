ALTER TABLE "profiles" ADD COLUMN "preferred_name" "bytea";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD COLUMN "audio_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_audio_seconds_not_negative" CHECK ("usage_counters"."audio_seconds" >= 0);--> statement-breakpoint
-- Everyone who had a diary before the welcome existed has already found their way: they are not sent through it.
INSERT INTO "profiles" ("user_id", "onboarded_at") SELECT "id", now() FROM "users" ON CONFLICT ("user_id") DO UPDATE SET "onboarded_at" = coalesce("profiles"."onboarded_at", now());
