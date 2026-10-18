CREATE TYPE "public"."proposal_kind" AS ENUM('entry', 'checkin');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('proposed', 'saved', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."provider_kind" AS ENUM('openai_compatible', 'anthropic', 'google');--> statement-breakpoint
CREATE TABLE "agent_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"provider" "provider_kind",
	"base_url" text,
	"model" text,
	"api_key" "bytea",
	"conversation_retention_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_settings_retention_range" CHECK ("agent_settings"."conversation_retention_days" between 1 and 3650)
);--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entry_id" uuid,
	"checkin_id" uuid,
	"fields" text[] NOT NULL,
	"previous" "bytea" NOT NULL,
	"note" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "corrections_one_record" CHECK (num_nonnulls("corrections"."entry_id", "corrections"."checkin_id") = 1)
);--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"kind" "proposal_kind" NOT NULL,
	"status" "proposal_status" DEFAULT 'proposed' NOT NULL,
	"payload" "bytea" NOT NULL,
	"edited" boolean DEFAULT false NOT NULL,
	"record_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_saved_has_record" CHECK ("proposals"."status" <> 'saved' or ("proposals"."record_id" is not null and "proposals"."decided_at" is not null))
);--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_id_user_id_key" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_id_user_id_key" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "agent_settings" ADD CONSTRAINT "agent_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_entry_owner_fk" FOREIGN KEY ("entry_id","user_id") REFERENCES "public"."entries"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_checkin_owner_fk" FOREIGN KEY ("checkin_id","user_id") REFERENCES "public"."checkins"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_conversation_owner_fk" FOREIGN KEY ("conversation_id","user_id") REFERENCES "public"."conversations"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "corrections_user_id_entry_id_idx" ON "corrections" USING btree ("user_id","entry_id","created_at");--> statement-breakpoint
CREATE INDEX "corrections_user_id_checkin_id_idx" ON "corrections" USING btree ("user_id","checkin_id","created_at");--> statement-breakpoint
CREATE INDEX "proposals_user_id_conversation_id_idx" ON "proposals" USING btree ("user_id","conversation_id","created_at");
