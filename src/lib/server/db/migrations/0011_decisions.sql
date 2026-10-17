CREATE TYPE "public"."decision_kind" AS ENUM('enrollment', 'pricing', 'distribution', 'promo', 'ads');--> statement-breakpoint
CREATE TYPE "public"."decision_source" AS ENUM('author', 'engine', 'agent');--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"author_id" uuid NOT NULL,
	"subject_type" varchar(40) NOT NULL,
	"subject_id" uuid NOT NULL,
	"kind" "decision_kind" NOT NULL,
	"choice" varchar(200) NOT NULL,
	"rationale" varchar(500),
	"assumptions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"commits_until" date,
	"source" "decision_source" NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_by" uuid,
	CONSTRAINT "decisions_author_id_id_key" UNIQUE("author_id","id")
);
--> statement-breakpoint
ALTER TABLE "decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_superseded_by_fk" FOREIGN KEY ("author_id","superseded_by") REFERENCES "public"."decisions"("author_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "decisions" AS PERMISSIVE FOR ALL TO public USING (author_id = nullif(current_setting('app.author_id', true), '')::uuid) WITH CHECK (author_id = nullif(current_setting('app.author_id', true), '')::uuid);--> statement-breakpoint
-- Append-only (#12, #26): a decision can't be edited. The one allowed change is setting
-- superseded_by once, when a newer decision replaces it. Deletes stay possible so that
-- deleting an account cascades.
CREATE FUNCTION decisions_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF OLD.superseded_by IS NULL
		AND NEW.superseded_by IS NOT NULL
		AND (to_jsonb(NEW) - 'superseded_by') = (to_jsonb(OLD) - 'superseded_by') THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'decisions are append-only: write a new decision and supersede this one'
		USING ERRCODE = 'check_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER decisions_append_only BEFORE UPDATE ON "decisions"
	FOR EACH ROW EXECUTE FUNCTION decisions_append_only();
