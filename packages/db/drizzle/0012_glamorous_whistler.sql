CREATE TYPE "public"."email_kind" AS ENUM('auth_verify', 'auth_reset', 'invoice_sent', 'payment_receipt', 'case_status', 'subscription_receipt');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'failed', 'suppressed');--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "email_kind" NOT NULL,
	"recipient" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"provider_message_id" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_log_dedupe_key_unique" ON "email_log" USING btree ("dedupe_key");