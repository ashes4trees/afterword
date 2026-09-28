-- Channel reference data (#10). Mirrors CHANNELS in src/lib/shared/channels.ts;
-- channels.integration.test.ts checks the two agree.
INSERT INTO "channels" ("slug", "display_name", "capabilities") VALUES
	('kdp', 'Amazon KDP', '{"formats": ["ebook"], "exclusivity": true, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb),
	('kdp_print', 'Amazon KDP Print', '{"formats": ["print"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb),
	('kobo', 'Kobo Writing Life', '{"formats": ["ebook"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb),
	('d2d', 'Draft2Digital', '{"formats": ["ebook", "print"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": true}'::jsonb),
	('ingram', 'IngramSpark', '{"formats": ["print", "ebook"], "exclusivity": false, "wholesaleDiscount": true, "returns": true, "aggregator": false}'::jsonb),
	('apple', 'Apple Books', '{"formats": ["ebook"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb),
	('google_play', 'Google Play Books', '{"formats": ["ebook"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb),
	('direct', 'Direct sales', '{"formats": ["ebook", "print", "audio"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb);
