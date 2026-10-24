CREATE TYPE "public"."campaign_status" AS ENUM('enabled', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."campaign_type" AS ENUM('sponsored_products', 'sponsored_brands', 'sponsored_display');--> statement-breakpoint
CREATE TYPE "public"."campaign_verdict" AS ENUM('too_young', 'keep', 'raise', 'lower', 'pause', 'kill');--> statement-breakpoint
CREATE TYPE "public"."targeting_kind" AS ENUM('auto', 'keyword', 'product', 'category');--> statement-breakpoint
CREATE TABLE "campaign_reviews" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verdict" "campaign_verdict" NOT NULL,
	"rule_id" varchar(120) NOT NULL,
	"rule_version" integer NOT NULL,
	"inputs" jsonb NOT NULL,
	"explanation" varchar(1000) NOT NULL,
	"narration" varchar(2000),
	"narration_model" varchar(80),
	CONSTRAINT "campaign_reviews_narration_has_model" CHECK (("campaign_reviews"."narration" is null) = ("campaign_reviews"."narration_model" is null))
);
--> statement-breakpoint
ALTER TABLE "campaign_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"channel_slug" varchar(40) NOT NULL,
	"marketplace" varchar(2) NOT NULL,
	"external_id" varchar(64),
	"name" varchar(200) NOT NULL,
	"campaign_type" "campaign_type" NOT NULL,
	"targeting_kind" "targeting_kind" NOT NULL,
	"status" "campaign_status" DEFAULT 'enabled' NOT NULL,
	"daily_budget_minor" integer,
	"currency" varchar(3) NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_author_id_id_key" UNIQUE("author_id","id"),
	CONSTRAINT "campaigns_marketplace_code" CHECK ("campaigns"."marketplace" ~ '^[A-Z]{2}$'),
	CONSTRAINT "campaigns_currency_code" CHECK ("campaigns"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "campaigns_budget_positive" CHECK ("campaigns"."daily_budget_minor" > 0),
	CONSTRAINT "campaigns_dates_order" CHECK ("campaigns"."ended_at" >= "campaigns"."started_at")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaign_reviews" ADD CONSTRAINT "campaign_reviews_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_reviews" ADD CONSTRAINT "campaign_reviews_campaign_fk" FOREIGN KEY ("author_id","campaign_id") REFERENCES "public"."campaigns"("author_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_channel_slug_channels_slug_fk" FOREIGN KEY ("channel_slug") REFERENCES "public"."channels"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_title_fk" FOREIGN KEY ("author_id","title_id") REFERENCES "public"."titles"("author_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_external_id_idx" ON "campaigns" USING btree ("author_id","channel_slug","marketplace","external_id") WHERE "campaigns"."external_id" is not null;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "campaign_reviews" AS PERMISSIVE FOR ALL TO public USING (author_id = nullif(current_setting('app.author_id', true), '')::uuid) WITH CHECK (author_id = nullif(current_setting('app.author_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "campaigns" AS PERMISSIVE FOR ALL TO public USING (author_id = nullif(current_setting('app.author_id', true), '')::uuid) WITH CHECK (author_id = nullif(current_setting('app.author_id', true), '')::uuid);