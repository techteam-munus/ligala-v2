CREATE TYPE "public"."user_status" AS ENUM('active', 'paused', 'banned');--> statement-breakpoint
CREATE TYPE "public"."admin_audit_action" AS ENUM('user_status_changed', 'user_role_changed', 'kyc_decided', 'discount_code_removed', 'invoice_refunded', 'invoice_voided', 'referral_force_decided');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_admin_id" text NOT NULL,
	"action" "admin_audit_action" NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"payload" jsonb,
	"reason" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "refunded_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_admin_id_user_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;