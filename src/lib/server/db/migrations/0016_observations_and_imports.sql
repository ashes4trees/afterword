CREATE TYPE "public"."import_kind" AS ENUM('kdp_report', 'kobo_report');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'parsed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."metric" AS ENUM('units', 'kenp_pages', 'royalty_minor', 'ad_spend_minor', 'ad_sales_minor', 'impressions', 'clicks');--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"channel_slug" varchar(40) NOT NULL,
	"kind" "import_kind" NOT NULL,
	"filename" varchar(255) NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"error" varchar(2000),
	"parsed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imports_author_id_id_key" UNIQUE("author_id","id"),
	CONSTRAINT "imports_failed_has_error" CHECK (("imports"."status" = 'failed') = ("imports"."error" is not null)),
	CONSTRAINT "imports_row_count_nonnegative" CHECK ("imports"."row_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"title_id" uuid,
	"external_id" varchar(64),
	"format" "book_format",
	"channel_slug" varchar(40) NOT NULL,
	"marketplace" varchar(2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"metric" "metric" NOT NULL,
	"value" bigint NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observations_marketplace_code" CHECK ("observations"."marketplace" ~ '^[A-Z]{2}$'),
	CONSTRAINT "observations_currency_code" CHECK ("observations"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "observations_period_order" CHECK ("observations"."period_end" >= "observations"."period_start")
);
--> statement-breakpoint
ALTER TABLE "observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_channel_slug_channels_slug_fk" FOREIGN KEY ("channel_slug") REFERENCES "public"."channels"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_channel_slug_channels_slug_fk" FOREIGN KEY ("channel_slug") REFERENCES "public"."channels"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_import_fk" FOREIGN KEY ("author_id","import_id") REFERENCES "public"."imports"("author_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_title_fk" FOREIGN KEY ("author_id","title_id") REFERENCES "public"."titles"("author_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "observations_title_metric_idx" ON "observations" USING btree ("author_id","title_id","metric","period_start");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "imports" AS PERMISSIVE FOR ALL TO public USING (author_id = nullif(current_setting('app.author_id', true), '')::uuid) WITH CHECK (author_id = nullif(current_setting('app.author_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "observations" AS PERMISSIVE FOR ALL TO public USING (author_id = nullif(current_setting('app.author_id', true), '')::uuid) WITH CHECK (author_id = nullif(current_setting('app.author_id', true), '')::uuid);