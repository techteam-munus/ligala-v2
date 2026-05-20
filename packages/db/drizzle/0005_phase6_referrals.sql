CREATE TYPE "public"."referral_kind" AS ENUM('case_referral', 'link_signup');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'accepted', 'declined', 'completed');--> statement-breakpoint
ALTER TYPE "public"."case_activity_kind" ADD VALUE 'referred';--> statement-breakpoint
ALTER TYPE "public"."case_activity_kind" ADD VALUE 'referral_accepted';--> statement-breakpoint
ALTER TYPE "public"."case_activity_kind" ADD VALUE 'referral_declined';--> statement-breakpoint
CREATE TABLE "referral_link" (
	"id" text PRIMARY KEY NOT NULL,
	"lawyer_id" text NOT NULL,
	"slug" text NOT NULL,
	"label" text,
	"active" boolean DEFAULT true NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"signups" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "referral_kind" NOT NULL,
	"from_lawyer_id" text NOT NULL,
	"to_lawyer_id" text NOT NULL,
	"case_id" text,
	"link_id" text,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"note_md" text,
	"payload" jsonb,
	"decided_at" timestamp with time zone,
	"decline_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lawyer_profile" ADD COLUMN "probono_available" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lawyer_profile" ADD COLUMN "probono_statement" text;--> statement-breakpoint
ALTER TABLE "lawyer_profile" ADD COLUMN "probono_cap_active" integer;--> statement-breakpoint
ALTER TABLE "case" ADD COLUMN "referral_id" text;--> statement-breakpoint
ALTER TABLE "case" ADD COLUMN "probono_reason" text;--> statement-breakpoint
ALTER TABLE "referral_link" ADD CONSTRAINT "referral_link_lawyer_id_user_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_from_lawyer_id_user_id_fk" FOREIGN KEY ("from_lawyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_to_lawyer_id_user_id_fk" FOREIGN KEY ("to_lawyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_link_id_referral_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."referral_link"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_link_slug_unique" ON "referral_link" USING btree ("slug");