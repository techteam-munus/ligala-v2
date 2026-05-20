CREATE TYPE "public"."kyc_document_kind" AS ENUM('government_id', 'bar_certificate', 'selfie', 'other');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ibp_chapter" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"city" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jurisdiction" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "practice_area" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lawyer_jurisdiction" (
	"lawyer_id" text NOT NULL,
	"jurisdiction_id" text NOT NULL,
	CONSTRAINT "lawyer_jurisdiction_lawyer_id_jurisdiction_id_pk" PRIMARY KEY("lawyer_id","jurisdiction_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lawyer_practice_area" (
	"lawyer_id" text NOT NULL,
	"practice_area_id" text NOT NULL,
	CONSTRAINT "lawyer_practice_area_lawyer_id_practice_area_id_pk" PRIMARY KEY("lawyer_id","practice_area_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lawyer_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"bar_number" text,
	"ibp_chapter_id" text,
	"bio" text,
	"profile_photo_s3_key" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_document" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"kind" "kyc_document_kind" NOT NULL,
	"s3_key" text NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"lawyer_id" text NOT NULL,
	"status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"idmeta_applicant_id" text,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"reject_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "office_faq" (
	"id" text PRIMARY KEY NOT NULL,
	"office_id" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "office_schedule" (
	"office_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"opens_at" time,
	"closes_at" time,
	"is_closed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "office_schedule_office_id_day_of_week_pk" PRIMARY KEY("office_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "office" (
	"id" text PRIMARY KEY NOT NULL,
	"lawyer_id" text NOT NULL,
	"name" text NOT NULL,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"country" text DEFAULT 'PH' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"phone" text,
	"email" text,
	"website" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "office_lawyer_id_unique" UNIQUE("lawyer_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lawyer_jurisdiction" ADD CONSTRAINT "lawyer_jurisdiction_lawyer_id_lawyer_profile_user_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."lawyer_profile"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lawyer_jurisdiction" ADD CONSTRAINT "lawyer_jurisdiction_jurisdiction_id_jurisdiction_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdiction"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lawyer_practice_area" ADD CONSTRAINT "lawyer_practice_area_lawyer_id_lawyer_profile_user_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."lawyer_profile"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lawyer_practice_area" ADD CONSTRAINT "lawyer_practice_area_practice_area_id_practice_area_id_fk" FOREIGN KEY ("practice_area_id") REFERENCES "public"."practice_area"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lawyer_profile" ADD CONSTRAINT "lawyer_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lawyer_profile" ADD CONSTRAINT "lawyer_profile_ibp_chapter_id_ibp_chapter_id_fk" FOREIGN KEY ("ibp_chapter_id") REFERENCES "public"."ibp_chapter"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_document" ADD CONSTRAINT "kyc_document_submission_id_kyc_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."kyc_submission"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_submission" ADD CONSTRAINT "kyc_submission_lawyer_id_lawyer_profile_user_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."lawyer_profile"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_submission" ADD CONSTRAINT "kyc_submission_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "office_faq" ADD CONSTRAINT "office_faq_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "office_schedule" ADD CONSTRAINT "office_schedule_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "office" ADD CONSTRAINT "office_lawyer_id_lawyer_profile_user_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."lawyer_profile"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ibp_chapter_name_unique" ON "ibp_chapter" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jurisdiction_name_unique" ON "jurisdiction" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "practice_area_name_unique" ON "practice_area" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lawyer_profile_slug_unique" ON "lawyer_profile" USING btree ("slug");