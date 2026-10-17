-- More stores (2026-10-17). Mirrors CHANNELS in src/lib/shared/channels.ts;
-- channels.integration.test.ts checks the two agree.
INSERT INTO "channels" ("slug", "display_name", "capabilities") VALUES
	('bn_press', 'Barnes & Noble Press', '{"formats": ["ebook", "print"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb),
	('acx', 'Audible (ACX)', '{"formats": ["audio"], "exclusivity": true, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb),
	('findaway', 'Spotify (Findaway Voices)', '{"formats": ["audio"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": true}'::jsonb),
	('kickstarter', 'Kickstarter', '{"formats": ["ebook", "print", "audio"], "exclusivity": false, "wholesaleDiscount": false, "returns": false, "aggregator": false}'::jsonb);
