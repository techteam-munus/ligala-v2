CREATE TYPE "public"."balance_entry_direction" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "public"."balance_entry_kind" AS ENUM('earning', 'processing_fee', 'payout', 'payout_fee', 'refund_reversal', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."payout_method_type" AS ENUM('gcash', 'maya', 'bank');--> statement-breakpoint
CREATE TYPE "public"."payout_provider" AS ENUM('paymongo', 'dev_simulate');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'returned');--> statement-breakpoint
CREATE TABLE "balance_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"lawyer_id" text NOT NULL,
	"kind" "balance_entry_kind" NOT NULL,
	"direction" "balance_entry_direction" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'PHP' NOT NULL,
	"clears_at" timestamp with time zone NOT NULL,
	"related_payment_id" text,
	"related_payout_id" text,
	"note" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lawyer_payout_method" (
	"id" text PRIMARY KEY NOT NULL,
	"lawyer_id" text NOT NULL,
	"type" "payout_method_type" NOT NULL,
	"account_number" text NOT NULL,
	"account_holder_name" text NOT NULL,
	"bank_bic" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout" (
	"id" text PRIMARY KEY NOT NULL,
	"lawyer_id" text NOT NULL,
	"payout_method_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"fee_cents" integer DEFAULT 1000 NOT NULL,
	"net_cents" integer NOT NULL,
	"currency" text DEFAULT 'PHP' NOT NULL,
	"provider" "payout_provider" NOT NULL,
	"provider_transfer_id" text,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"destination_snapshot" jsonb NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balance_entry" ADD CONSTRAINT "balance_entry_lawyer_id_user_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_entry" ADD CONSTRAINT "balance_entry_related_payment_id_payment_id_fk" FOREIGN KEY ("related_payment_id") REFERENCES "public"."payment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lawyer_payout_method" ADD CONSTRAINT "lawyer_payout_method_lawyer_id_user_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_lawyer_id_user_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_payout_method_id_lawyer_payout_method_id_fk" FOREIGN KEY ("payout_method_id") REFERENCES "public"."lawyer_payout_method"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balance_entry_lawyer_idx" ON "balance_entry" USING btree ("lawyer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_provider_transfer_id_unique" ON "payout" USING btree ("provider","provider_transfer_id");