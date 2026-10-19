CREATE TYPE "public"."session_repeat" AS ENUM('once', 'weekly', 'fortnightly', 'every_15_days', 'weekdays');--> statement-breakpoint
CREATE TABLE "therapy_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"starts_on" date NOT NULL,
	"session_time" time NOT NULL,
	"repeat" "session_repeat" NOT NULL,
	"weekdays" smallint[],
	"stops_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "therapy_series_id_user_id_key" UNIQUE("id","user_id"),
	CONSTRAINT "therapy_series_weekdays" CHECK (("therapy_series"."repeat" = 'weekdays') = ("therapy_series"."weekdays" is not null) and ("therapy_series"."weekdays" is null or (cardinality("therapy_series"."weekdays") between 1 and 7 and "therapy_series"."weekdays" <@ '{0,1,2,3,4,5,6}'::smallint[]))),
	CONSTRAINT "therapy_series_stops_after_start" CHECK ("therapy_series"."stops_on" is null or "therapy_series"."stops_on" > "therapy_series"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "therapy_series_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"series_id" uuid NOT NULL,
	"occurs_on" date NOT NULL,
	"moved_on" date,
	"moved_time" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "therapy_series_changes_session_key" UNIQUE("series_id","occurs_on"),
	CONSTRAINT "therapy_series_changes_moved_whole" CHECK (("therapy_series_changes"."moved_on" is null) = ("therapy_series_changes"."moved_time" is null))
);
--> statement-breakpoint
ALTER TABLE "therapy_series" ADD CONSTRAINT "therapy_series_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_series_changes" ADD CONSTRAINT "therapy_series_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_series_changes" ADD CONSTRAINT "therapy_series_changes_series_owner_fk" FOREIGN KEY ("series_id","user_id") REFERENCES "public"."therapy_series"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "therapy_series_user_id_idx" ON "therapy_series" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "therapy_series_changes_user_id_idx" ON "therapy_series_changes" USING btree ("user_id");--> statement-breakpoint
-- F11: Therapy's sessions are a calendar (DECISIONS 113). Every weekly slot becomes a weekly rhythm on the same day and
-- time, starting on a week that has already gone by, so the next session and the report before it are what they were,
-- and the past week's session is still one the scheduler recognises. The slot's columns stay, because migrations are
-- additive, and are emptied, so nothing goes on reading a slot the calendar now holds.
INSERT INTO "therapy_series" ("user_id", "starts_on", "session_time", "repeat")
SELECT ts."user_id",
  d.local_day - ((extract(dow from d.local_day)::int - ts."session_day" + 7) % 7),
  ts."session_time",
  'weekly'
FROM "therapy_settings" ts
LEFT JOIN "profiles" p ON p."user_id" = ts."user_id"
CROSS JOIN LATERAL (
  SELECT (least(ts."updated_at", now() - interval '7 days') AT TIME ZONE coalesce(p."timezone", 'UTC'))::date AS local_day
) d
WHERE ts."session_day" IS NOT NULL AND ts."session_time" IS NOT NULL;--> statement-breakpoint
UPDATE "therapy_settings" SET "session_day" = NULL, "session_time" = NULL
WHERE "session_day" IS NOT NULL OR "session_time" IS NOT NULL;
