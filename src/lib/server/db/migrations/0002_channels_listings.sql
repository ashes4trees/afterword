CREATE TYPE "public"."listing_status" AS ENUM('not_started', 'metadata_draft', 'submitted', 'in_review', 'live', 'unpublished');--> statement-breakpoint
CREATE TABLE "channel_listings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"channel_slug" varchar(40) NOT NULL,
	"marketplace" varchar(2),
	"status" "listing_status" DEFAULT 'not_started' NOT NULL,
	"external_id" varchar(64),
	"price_minor" integer,
	"currency" varchar(3),
	"enrolled_in_select" boolean DEFAULT false NOT NULL,
	"exclusivity_start" date,
	"exclusivity_end" date,
	"wholesale_discount_pct" smallint,
	"returnable" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_listings_title_channel_marketplace_key" UNIQUE NULLS NOT DISTINCT("title_id","channel_slug","marketplace"),
	CONSTRAINT "channel_listings_marketplace_code" CHECK ("channel_listings"."marketplace" ~ '^[A-Z]{2}$'),
	CONSTRAINT "channel_listings_currency_code" CHECK ("channel_listings"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "channel_listings_price_has_currency" CHECK (("channel_listings"."price_minor" is null) = ("channel_listings"."currency" is null)),
	CONSTRAINT "channel_listings_price_nonnegative" CHECK ("channel_listings"."price_minor" >= 0),
	CONSTRAINT "channel_listings_exclusivity_order" CHECK ("channel_listings"."exclusivity_end" >= "channel_listings"."exclusivity_start"),
	CONSTRAINT "channel_listings_wholesale_discount_range" CHECK ("channel_listings"."wholesale_discount_pct" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "channel_listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "channels" (
	"slug" varchar(40) PRIMARY KEY NOT NULL,
	"display_name" varchar(80) NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_channel_slug_channels_slug_fk" FOREIGN KEY ("channel_slug") REFERENCES "public"."channels"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_title_fk" FOREIGN KEY ("author_id","title_id") REFERENCES "public"."titles"("author_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "channel_listings" AS PERMISSIVE FOR ALL TO public USING (author_id = nullif(current_setting('app.author_id', true), '')::uuid) WITH CHECK (author_id = nullif(current_setting('app.author_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "channels_read" ON "channels" AS PERMISSIVE FOR SELECT TO public USING (true);