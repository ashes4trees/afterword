ALTER TYPE "public"."task_source" ADD VALUE 'idea';--> statement-breakpoint
CREATE TABLE "idea_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"pack" varchar(80) NOT NULL,
	"step_id" varchar(60) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idea_dismissals_title_step_key" UNIQUE("title_id","pack","step_id")
);
--> statement-breakpoint
ALTER TABLE "idea_dismissals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "idea_dismissals" ADD CONSTRAINT "idea_dismissals_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_dismissals" ADD CONSTRAINT "idea_dismissals_title_fk" FOREIGN KEY ("author_id","title_id") REFERENCES "public"."titles"("author_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "idea_dismissals" AS PERMISSIVE FOR ALL TO public USING (author_id = nullif(current_setting('app.author_id', true), '')::uuid) WITH CHECK (author_id = nullif(current_setting('app.author_id', true), '')::uuid);