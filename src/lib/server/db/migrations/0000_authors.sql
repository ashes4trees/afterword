CREATE TYPE "public"."ai_mode" AS ENUM('off', 'byok', 'managed');--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"ai_mode" "ai_mode" DEFAULT 'off' NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "authors_email_lower_idx" ON "authors" USING btree (lower("email"));