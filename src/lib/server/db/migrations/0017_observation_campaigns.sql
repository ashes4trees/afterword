ALTER TABLE "observations" ALTER COLUMN "import_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_campaign_fk" FOREIGN KEY ("author_id","campaign_id") REFERENCES "public"."campaigns"("author_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_has_origin" CHECK ("observations"."import_id" is not null or "observations"."campaign_id" is not null);