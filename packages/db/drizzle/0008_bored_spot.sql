ALTER TYPE "public"."admin_audit_action" ADD VALUE 'ibp_lawyer_added';--> statement-breakpoint
CREATE TABLE "ibp_lawyer" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"address" text NOT NULL,
	"roll_signed" date NOT NULL,
	"roll_number" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ibp_lawyer_roll_number_unique" ON "ibp_lawyer" USING btree ("roll_number");