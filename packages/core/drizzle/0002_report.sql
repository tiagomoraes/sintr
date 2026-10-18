CREATE TYPE "public"."report_revision_kind" AS ENUM('edited', 'prepared_again');--> statement-breakpoint
CREATE TABLE "report_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"report_id" uuid NOT NULL,
	"kind" "report_revision_kind" NOT NULL,
	"sections" text[] NOT NULL,
	"previous" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "therapy_settings" ADD COLUMN "next_session_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "therapy_settings" ADD COLUMN "report_notice_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "report_revisions" ADD CONSTRAINT "report_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_revisions" ADD CONSTRAINT "report_revisions_report_owner_fk" FOREIGN KEY ("report_id","user_id") REFERENCES "public"."reports"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_revisions_user_id_report_id_idx" ON "report_revisions" USING btree ("user_id","report_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_user_id_session_at_key" ON "reports" USING btree ("user_id","session_at") WHERE "reports"."session_at" is not null;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_period_end_key" UNIQUE("user_id","period_end");