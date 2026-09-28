ALTER TABLE "titles" ADD COLUMN "content_sex" smallint;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "content_violence" smallint;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "content_language" smallint;--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_content_sex_range" CHECK ("titles"."content_sex" between 0 and 5);--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_content_violence_range" CHECK ("titles"."content_violence" between 0 and 5);--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_content_language_range" CHECK ("titles"."content_language" between 0 and 5);--> statement-breakpoint
-- Heat level becomes the sex rating (#53).
UPDATE "titles" SET "content_sex" = "heat_level" WHERE "heat_level" IS NOT NULL;
