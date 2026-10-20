CREATE TYPE "public"."idea_phase" AS ENUM('writing', 'prelaunch', 'launch', 'after');--> statement-breakpoint
CREATE TABLE "author_ideas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"label" varchar(120) NOT NULL,
	"note" varchar(280),
	"phase" "idea_phase" NOT NULL,
	"window_from_days" smallint,
	"window_to_days" smallint,
	"repeatable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "author_ideas_author_id_id_key" UNIQUE("author_id","id"),
	CONSTRAINT "author_ideas_window_complete" CHECK (("author_ideas"."window_from_days" is null) = ("author_ideas"."window_to_days" is null)),
	CONSTRAINT "author_ideas_window_order" CHECK ("author_ideas"."window_from_days" is null or ("author_ideas"."window_from_days" <= "author_ideas"."window_to_days" and "author_ideas"."window_from_days" >= -730 and "author_ideas"."window_to_days" <= 730))
);
--> statement-breakpoint
ALTER TABLE "author_ideas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "author_ideas" ADD CONSTRAINT "author_ideas_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "author_ideas" AS PERMISSIVE FOR ALL TO public USING (author_id = nullif(current_setting('app.author_id', true), '')::uuid) WITH CHECK (author_id = nullif(current_setting('app.author_id', true), '')::uuid);