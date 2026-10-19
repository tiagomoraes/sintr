-- F10: the memory (DECISIONS 113 to 118). Its vectors need pgvector, which the bundled stack's Postgres
-- carries (docker/postgres.Dockerfile). A Postgres of one's own needs the extension installed first; without
-- it, this migration stops here and says so, before anything changes (docs/SELFHOST.md, "Upgrading to the memory").
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    RAISE EXCEPTION 'sintr 0009 needs the pgvector extension (vector) in this Postgres: see docs/SELFHOST.md, "Upgrading to the memory"';
  END IF;
END $$;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."memory_kind" AS ENUM('name', 'about', 'moment');--> statement-breakpoint
ALTER TYPE "public"."consent_purpose" ADD VALUE 'memory';--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "memory_kind" NOT NULL,
	"text" "bytea" NOT NULL,
	"quote" "bytea",
	"entry_id" uuid,
	"checkin_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"embedding" vector,
	"embedding_model" text,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memories_source" CHECK (case when "memories"."kind" = 'name' then num_nonnulls("memories"."entry_id", "memories"."checkin_id") = 0
        else num_nonnulls("memories"."entry_id", "memories"."checkin_id") = 1 and "memories"."quote" is not null end),
	CONSTRAINT "memories_vector_has_model" CHECK (("memories"."embedding" is null) = ("memories"."embedding_model" is null))
);
--> statement-breakpoint
CREATE TABLE "memory_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entry_id" uuid,
	"checkin_id" uuid,
	"source_updated_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memory_reads_one_source" CHECK (num_nonnulls("memory_reads"."entry_id", "memory_reads"."checkin_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_entry_owner_fk" FOREIGN KEY ("entry_id","user_id") REFERENCES "public"."entries"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_checkin_owner_fk" FOREIGN KEY ("checkin_id","user_id") REFERENCES "public"."checkins"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_reads" ADD CONSTRAINT "memory_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_reads" ADD CONSTRAINT "memory_reads_entry_owner_fk" FOREIGN KEY ("entry_id","user_id") REFERENCES "public"."entries"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_reads" ADD CONSTRAINT "memory_reads_checkin_owner_fk" FOREIGN KEY ("checkin_id","user_id") REFERENCES "public"."checkins"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memories_user_id_kind_idx" ON "memories" USING btree ("user_id","kind","occurred_at");--> statement-breakpoint
CREATE INDEX "memories_user_id_model_idx" ON "memories" USING btree ("user_id","embedding_model");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_reads_user_id_entry_id_key" ON "memory_reads" USING btree ("user_id","entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_reads_user_id_checkin_id_key" ON "memory_reads" USING btree ("user_id","checkin_id");