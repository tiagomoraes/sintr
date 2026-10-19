CREATE TYPE "public"."invite_direction" AS ENUM('practice_to_person', 'person_to_practice');--> statement-breakpoint
CREATE TYPE "public"."link_party" AS ENUM('person', 'practice');--> statement-breakpoint
CREATE TYPE "public"."link_status" AS ENUM('pending', 'active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('link_pending', 'link_active', 'link_declined', 'link_ended', 'report_shared');--> statement-breakpoint
CREATE TYPE "public"."seat_source" AS ENUM('config', 'grant');--> statement-breakpoint
CREATE TYPE "public"."share_mode" AS ENUM('ask', 'auto');--> statement-breakpoint
ALTER TYPE "public"."consent_purpose" ADD VALUE 'practice_link';--> statement-breakpoint
ALTER TYPE "public"."consent_purpose" ADD VALUE 'report_share';--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"direction" "invite_direction" NOT NULL,
	"practice_id" uuid,
	"code_hash" text NOT NULL,
	"code" "bytea" NOT NULL,
	"note" "bytea",
	"person_name" "bytea",
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"link_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "invites_practice_invite_names_practice" CHECK ("invites"."direction" = 'person_to_practice' or "invites"."practice_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"practice_id" uuid NOT NULL,
	"status" "link_status" NOT NULL,
	"number" integer NOT NULL,
	"person_name" "bytea",
	"share_mode" "share_mode" DEFAULT 'ask' NOT NULL,
	"kek_id" text,
	"wrapped_key" "bytea",
	"person_accepted_at" timestamp with time zone,
	"practice_accepted_at" timestamp with time zone,
	"consent_id" uuid,
	"ended_at" timestamp with time zone,
	"ended_by" "link_party",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_id_user_id_key" UNIQUE("id","user_id"),
	CONSTRAINT "links_active_needs_both" CHECK ("links"."status" <> 'active' or ("links"."consent_id" is not null and "links"."person_accepted_at" is not null and "links"."practice_accepted_at" is not null)),
	CONSTRAINT "links_open_holds_key" CHECK ("links"."status" = 'ended' or ("links"."wrapped_key" is not null and "links"."kek_id" is not null)),
	CONSTRAINT "links_ended_holds_nothing" CHECK ("links"."status" <> 'ended' or ("links"."ended_at" is not null and "links"."ended_by" is not null and "links"."wrapped_key" is null and "links"."person_name" is null)),
	CONSTRAINT "links_number_positive" CHECK ("links"."number" > 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"link_id" uuid,
	"shared_report_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"professional_name" "bytea" NOT NULL,
	"practice_name" "bytea",
	"registration" "bytea",
	"seat_source" "seat_source" DEFAULT 'config' NOT NULL,
	"plan" text,
	"seats" integer,
	"notify_email" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practices_seats_range" CHECK ("practices"."seats" is null or "practices"."seats" between 0 and 100000),
	CONSTRAINT "practices_grant_names_plan" CHECK ("practices"."seat_source" = 'config' or "practices"."plan" is not null)
);
--> statement-breakpoint
CREATE TABLE "shared_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"link_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"consent_id" uuid NOT NULL,
	"session_at" timestamp with time zone,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"snapshot" "bytea" NOT NULL,
	"pdf" "bytea" NOT NULL,
	"first_read_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_reports_link_id_report_id_key" UNIQUE("link_id","report_id")
);
--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN "link_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_consent_owner_fk" FOREIGN KEY ("consent_id","user_id") REFERENCES "public"."consents"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_shared_report_id_shared_reports_id_fk" FOREIGN KEY ("shared_report_id") REFERENCES "public"."shared_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practices" ADD CONSTRAINT "practices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_reports" ADD CONSTRAINT "shared_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_reports" ADD CONSTRAINT "shared_reports_link_owner_fk" FOREIGN KEY ("link_id","user_id") REFERENCES "public"."links"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_reports" ADD CONSTRAINT "shared_reports_report_owner_fk" FOREIGN KEY ("report_id","user_id") REFERENCES "public"."reports"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_reports" ADD CONSTRAINT "shared_reports_consent_owner_fk" FOREIGN KEY ("consent_id","user_id") REFERENCES "public"."consents"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invites_user_id_created_at_idx" ON "invites" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "invites_practice_id_idx" ON "invites" USING btree ("practice_id");--> statement-breakpoint
CREATE INDEX "links_user_id_created_at_idx" ON "links" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "links_practice_id_status_idx" ON "links" USING btree ("practice_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "links_practice_id_number_key" ON "links" USING btree ("practice_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "links_user_id_practice_id_open_key" ON "links" USING btree ("user_id","practice_id") WHERE "links"."status" <> 'ended';--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "practices_user_id_key" ON "practices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shared_reports_user_id_created_at_idx" ON "shared_reports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "shared_reports_link_id_created_at_idx" ON "shared_reports" USING btree ("link_id","created_at");--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_practice_names_link" CHECK ("consents"."purpose"::text not in ('practice_link', 'report_share') or "consents"."link_id" is not null);--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_report_share_names_report" CHECK ("consents"."purpose"::text <> 'report_share' or "consents"."report_id" is not null);