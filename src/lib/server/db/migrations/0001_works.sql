CREATE TYPE "public"."title_stage" AS ENUM('metadata', 'uploaded', 'preorder', 'launch', 'post_launch', 'backlist');--> statement-breakpoint
CREATE TABLE "pen_names" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pen_names_author_id_id_key" UNIQUE("author_id","id")
);
--> statement-breakpoint
ALTER TABLE "pen_names" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"pen_name_id" uuid,
	"title" varchar(200) NOT NULL,
	"planned_count" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_author_id_id_key" UNIQUE("author_id","id"),
	CONSTRAINT "series_planned_count_positive" CHECK ("series"."planned_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "series" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "titles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"pen_name_id" uuid,
	"series_id" uuid,
	"series_position" numeric(5, 2),
	"working_title" varchar(200) NOT NULL,
	"genre" varchar(60),
	"subgenre" varchar(60),
	"tropes" varchar(60)[] DEFAULT '{}' NOT NULL,
	"heat_level" smallint,
	"page_count" integer,
	"word_count" integer,
	"release_date" date,
	"stage" "title_stage" DEFAULT 'metadata' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "titles_author_id_id_key" UNIQUE("author_id","id"),
	CONSTRAINT "titles_series_position_needs_series" CHECK ("titles"."series_position" is null or "titles"."series_id" is not null),
	CONSTRAINT "titles_series_position_positive" CHECK ("titles"."series_position" > 0),
	CONSTRAINT "titles_heat_level_range" CHECK ("titles"."heat_level" between 0 and 5),
	CONSTRAINT "titles_page_count_positive" CHECK ("titles"."page_count" > 0),
	CONSTRAINT "titles_word_count_positive" CHECK ("titles"."word_count" > 0),
	CONSTRAINT "titles_tropes_max" CHECK (cardinality("titles"."tropes") <= 20)
);
--> statement-breakpoint
ALTER TABLE "titles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pen_names" ADD CONSTRAINT "pen_names_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_pen_name_fk" FOREIGN KEY ("author_id","pen_name_id") REFERENCES "public"."pen_names"("author_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_pen_name_fk" FOREIGN KEY ("author_id","pen_name_id") REFERENCES "public"."pen_names"("author_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_series_fk" FOREIGN KEY ("author_id","series_id") REFERENCES "public"."series"("author_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pen_names_author_name_idx" ON "pen_names" USING btree ("author_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "series_author_title_idx" ON "series" USING btree ("author_id",lower("title"));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "pen_names" AS PERMISSIVE FOR ALL TO public USING (author_id = nullif(current_setting('app.author_id', true), '')::uuid) WITH CHECK (author_id = nullif(current_setting('app.author_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "series" AS PERMISSIVE FOR ALL TO public USING (author_id = nullif(current_setting('app.author_id', true), '')::uuid) WITH CHECK (author_id = nullif(current_setting('app.author_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "titles" AS PERMISSIVE FOR ALL TO public USING (author_id = nullif(current_setting('app.author_id', true), '')::uuid) WITH CHECK (author_id = nullif(current_setting('app.author_id', true), '')::uuid);