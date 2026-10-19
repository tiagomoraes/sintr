ALTER TABLE "profiles" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "seen_locale" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "report_language" text;--> statement-breakpoint
-- The report language chosen in Therapy before F7 was kept in "language", whose default is English, so only a
-- language other than English is known to be a choice. Those stay; the rest follow the person's language.
UPDATE "profiles" SET "report_language" = "language" WHERE lower("language") NOT LIKE 'en%';
