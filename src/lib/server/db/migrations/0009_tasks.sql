CREATE TYPE "public"."task_source" AS ENUM('playbook', 'author');--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"source" "task_source" NOT NULL,
	"pack" varchar(80),
	"pack_version" integer,
	"step_id" varchar(60),
	"channel_slug" varchar(40),
	"format" "book_format",
	"label" varchar(120) NOT NULL,
	"due_on" date,
	"due_pinned" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone,
	"skipped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_listing_has_format" CHECK (("tasks"."channel_slug" is null) = ("tasks"."format" is null)),
	CONSTRAINT "tasks_playbook_has_step" CHECK ("tasks"."source" = 'author' or ("tasks"."pack" is not null and "tasks"."step_id" is not null and "tasks"."pack_version" is not null)),
	CONSTRAINT "tasks_done_or_skipped" CHECK ("tasks"."done_at" is null or "tasks"."skipped_at" is null)
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_channel_slug_channels_slug_fk" FOREIGN KEY ("channel_slug") REFERENCES "public"."channels"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_title_fk" FOREIGN KEY ("author_id","title_id") REFERENCES "public"."titles"("author_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_title_step_idx" ON "tasks" USING btree ("title_id","pack","step_id") WHERE "tasks"."source" = 'playbook' and "tasks"."channel_slug" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_listing_step_idx" ON "tasks" USING btree ("title_id","pack","step_id","channel_slug","format") WHERE "tasks"."source" = 'playbook' and "tasks"."channel_slug" is not null;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tasks" AS PERMISSIVE FOR ALL TO public USING (author_id = nullif(current_setting('app.author_id', true), '')::uuid) WITH CHECK (author_id = nullif(current_setting('app.author_id', true), '')::uuid);