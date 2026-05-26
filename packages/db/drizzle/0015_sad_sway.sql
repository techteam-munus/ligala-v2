CREATE TYPE "public"."kyc_method" AS ENUM('upload', 'idmeta');--> statement-breakpoint
ALTER TABLE "kyc_submission" ADD COLUMN "method" "kyc_method" DEFAULT 'upload' NOT NULL;