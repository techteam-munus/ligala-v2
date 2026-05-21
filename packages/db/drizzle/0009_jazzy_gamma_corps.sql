ALTER TABLE "ibp_lawyer" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "ibp_lawyer" ADD CONSTRAINT "ibp_lawyer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ibp_lawyer_user_id_unique" ON "ibp_lawyer" USING btree ("user_id");