CREATE TYPE "public"."invoice_kind" AS ENUM('case', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due');--> statement-breakpoint
CREATE TABLE "lawyer_subscription" (
	"lawyer_id" text PRIMARY KEY NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"trial_ends_at" timestamp with time zone NOT NULL,
	"current_period_ends_at" timestamp with time zone NOT NULL,
	"last_paid_at" timestamp with time zone,
	"price_cents" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "case_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "kind" "invoice_kind" DEFAULT 'case' NOT NULL;--> statement-breakpoint
ALTER TABLE "lawyer_subscription" ADD CONSTRAINT "lawyer_subscription_lawyer_id_user_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_kind_consistency" CHECK (("invoice"."kind" = 'case' AND "invoice"."case_id" IS NOT NULL AND "invoice"."client_id" IS NOT NULL) OR ("invoice"."kind" = 'subscription' AND "invoice"."case_id" IS NULL AND "invoice"."client_id" IS NULL));--> statement-breakpoint
-- Backfill: give every existing lawyer a fresh 30-day trial starting from the
-- migration date. New lawyers signing up after this get their row inserted by
-- claimIbpAndPromote(). ON CONFLICT keeps this re-runnable.
INSERT INTO "lawyer_subscription" ("lawyer_id", "status", "trial_ends_at", "current_period_ends_at", "price_cents", "created_at", "updated_at")
SELECT u."id", 'trialing', now() + interval '30 days', now() + interval '30 days', 99900, now(), now()
FROM "user" u
WHERE u."role" = 'lawyer'
ON CONFLICT ("lawyer_id") DO NOTHING;