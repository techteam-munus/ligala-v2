CREATE TYPE "public"."case_activity_kind" AS ENUM('created', 'accepted', 'declined', 'engagement_sent', 'engagement_signed', 'engagement_declined', 'activated', 'note_added', 'attachment_added', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."case_note_visibility" AS ENUM('shared', 'lawyer', 'client');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('pending', 'declined', 'accepted', 'active', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."case_type" AS ENUM('paid', 'probono');--> statement-breakpoint
CREATE TYPE "public"."engagement_rate_type" AS ENUM('hourly', 'flat', 'contingency');--> statement-breakpoint
CREATE TYPE "public"."engagement_status" AS ENUM('sent', 'signed', 'declined');--> statement-breakpoint
CREATE TABLE "case_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"actor_user_id" text,
	"kind" "case_activity_kind" NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"uploader_user_id" text NOT NULL,
	"s3_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" bigint,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_note" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"visibility" "case_note_visibility" DEFAULT 'shared' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"lawyer_id" text NOT NULL,
	"type" "case_type" NOT NULL,
	"status" "case_status" DEFAULT 'pending' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"practice_area_id" text,
	"jurisdiction_id" text,
	"decided_at" timestamp with time zone,
	"decline_reason" text,
	"closed_at" timestamp with time zone,
	"close_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"rate_type" "engagement_rate_type" NOT NULL,
	"hourly_cents" integer,
	"flat_cents" integer,
	"contingency_bps" integer,
	"terms_md" text NOT NULL,
	"status" "engagement_status" DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"decline_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "engagement_case_id_unique" UNIQUE("case_id")
);
--> statement-breakpoint
ALTER TABLE "case_activity" ADD CONSTRAINT "case_activity_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_activity" ADD CONSTRAINT "case_activity_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_attachment" ADD CONSTRAINT "case_attachment_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_attachment" ADD CONSTRAINT "case_attachment_uploader_user_id_user_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_note" ADD CONSTRAINT "case_note_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_note" ADD CONSTRAINT "case_note_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case" ADD CONSTRAINT "case_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case" ADD CONSTRAINT "case_lawyer_id_user_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case" ADD CONSTRAINT "case_practice_area_id_practice_area_id_fk" FOREIGN KEY ("practice_area_id") REFERENCES "public"."practice_area"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case" ADD CONSTRAINT "case_jurisdiction_id_jurisdiction_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdiction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement" ADD CONSTRAINT "engagement_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;