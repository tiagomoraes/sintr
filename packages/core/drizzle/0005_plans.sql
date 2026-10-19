CREATE TYPE "public"."subscription_kind" AS ENUM('person', 'practice');--> statement-breakpoint
CREATE TYPE "public"."subscription_source" AS ENUM('grant', 'stripe');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete', 'incomplete_expired', 'canceled');--> statement-breakpoint
ALTER TYPE "public"."seat_source" ADD VALUE 'subscription';--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "subscription_kind" NOT NULL,
	"plan" text NOT NULL,
	"status" "subscription_status" NOT NULL,
	"source" "subscription_source" NOT NULL,
	"seats" integer,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"provider_customer_id" text,
	"provider_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_provider_subscription_id_unique" UNIQUE("provider_subscription_id"),
	CONSTRAINT "subscriptions_seats_range" CHECK ("subscriptions"."seats" is null or "subscriptions"."seats" between 0 and 100000),
	CONSTRAINT "subscriptions_provider_names_subscription" CHECK ("subscriptions"."source" = 'grant' or "subscriptions"."provider_subscription_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"user_id" text NOT NULL,
	"period" date NOT NULL,
	"assistant_messages" integer DEFAULT 0 NOT NULL,
	"reports" integer DEFAULT 0 NOT NULL,
	"audio_minutes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_counters_pkey" PRIMARY KEY("user_id","period"),
	CONSTRAINT "usage_counters_period_is_month" CHECK (extract(day from "usage_counters"."period") = 1),
	CONSTRAINT "usage_counters_not_negative" CHECK ("usage_counters"."assistant_messages" >= 0 and "usage_counters"."reports" >= 0 and "usage_counters"."audio_minutes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_id_kind_key" ON "subscriptions" USING btree ("user_id","kind");