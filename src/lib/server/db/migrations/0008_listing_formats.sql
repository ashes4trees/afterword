-- Per-format listings (#72). Generated schema changes, with the data steps between
-- them written by hand.
CREATE TYPE "public"."book_format" AS ENUM('ebook', 'paperback', 'hardcover', 'audiobook');--> statement-breakpoint
ALTER TABLE "channel_listings" DROP CONSTRAINT "channel_listings_title_channel_marketplace_key";--> statement-breakpoint
-- Existing listings were ebook unless they were on KDP Print, which merges into Amazon KDP.
ALTER TABLE "channel_listings" ADD COLUMN "format" "book_format" NOT NULL DEFAULT 'ebook';--> statement-breakpoint
UPDATE "channel_listings" SET "channel_slug" = 'kdp', "format" = 'paperback' WHERE "channel_slug" = 'kdp_print';--> statement-breakpoint
ALTER TABLE "channel_listings" ALTER COLUMN "format" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "formats" "book_format"[] DEFAULT '{ebook}' NOT NULL;--> statement-breakpoint
-- Existing books get ebook and paperback, the common indie setup, plus any format
-- they already have listings in.
UPDATE "titles" t SET "formats" = ARRAY(
	SELECT DISTINCT f FROM unnest(ARRAY['ebook', 'paperback']::"book_format"[] || ARRAY(
		SELECT l."format" FROM "channel_listings" l WHERE l."title_id" = t."id"
	)) AS f ORDER BY f
);--> statement-breakpoint
-- Store formats now name editions rather than ebook/print/audio.
UPDATE "channels" SET "capabilities" = '{"formats": ["ebook", "paperback", "hardcover"], "exclusivity": true, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb WHERE "slug" = 'kdp';--> statement-breakpoint
UPDATE "channels" SET "capabilities" = '{"formats": ["ebook", "audiobook"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb WHERE "slug" = 'kobo';--> statement-breakpoint
UPDATE "channels" SET "capabilities" = '{"formats": ["ebook", "paperback"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": true}'::jsonb WHERE "slug" = 'd2d';--> statement-breakpoint
UPDATE "channels" SET "capabilities" = '{"formats": ["paperback", "hardcover", "ebook"], "exclusivity": false, "wholesaleDiscount": true, "returns": true, "aggregator": false}'::jsonb WHERE "slug" = 'ingram';--> statement-breakpoint
UPDATE "channels" SET "capabilities" = '{"formats": ["ebook"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb WHERE "slug" = 'apple';--> statement-breakpoint
UPDATE "channels" SET "capabilities" = '{"formats": ["ebook", "audiobook"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb WHERE "slug" = 'google_play';--> statement-breakpoint
UPDATE "channels" SET "capabilities" = '{"formats": ["ebook", "paperback", "hardcover"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb WHERE "slug" = 'bn_press';--> statement-breakpoint
UPDATE "channels" SET "capabilities" = '{"formats": ["audiobook"], "exclusivity": true, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb WHERE "slug" = 'acx';--> statement-breakpoint
UPDATE "channels" SET "capabilities" = '{"formats": ["audiobook"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": true}'::jsonb WHERE "slug" = 'findaway';--> statement-breakpoint
UPDATE "channels" SET "capabilities" = '{"formats": ["ebook", "paperback", "hardcover", "audiobook"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb WHERE "slug" = 'kickstarter';--> statement-breakpoint
UPDATE "channels" SET "capabilities" = '{"formats": ["ebook", "paperback", "hardcover", "audiobook"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb WHERE "slug" = 'direct';--> statement-breakpoint
DELETE FROM "channels" WHERE "slug" = 'kdp_print';--> statement-breakpoint
-- Saved store choices that named KDP Print.
UPDATE "authors" SET "preferences" = jsonb_set("preferences", '{hidden_channels}', ("preferences"->'hidden_channels') - 'kdp_print') WHERE "preferences" ? 'hidden_channels';--> statement-breakpoint
UPDATE "authors" SET "preferences" = jsonb_set("preferences", '{default_channels}', ("preferences"->'default_channels') - 'kdp_print') WHERE "preferences" ? 'default_channels';--> statement-breakpoint
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_title_channel_format_marketplace_key" UNIQUE NULLS NOT DISTINCT("title_id","channel_slug","format","marketplace");--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_formats_present" CHECK (cardinality("titles"."formats") >= 1);
