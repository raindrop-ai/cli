PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`span_id` text,
	`kind` text NOT NULL,
	`note` text,
	`source` text NOT NULL CHECK(`source` IN ('user', 'claude-code', 'codex', 'opencode')),
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_annotations` (`id`, `run_id`, `span_id`, `kind`, `note`, `source`, `created_at`)
SELECT `id`, `run_id`, `span_id`, `kind`, `note`, `source`, `created_at` FROM `annotations`;
--> statement-breakpoint
DROP TABLE `annotations`;
--> statement-breakpoint
ALTER TABLE `__new_annotations` RENAME TO `annotations`;
--> statement-breakpoint
CREATE INDEX `idx_annotations_run` ON `annotations` (`run_id`);
--> statement-breakpoint
CREATE INDEX `idx_annotations_span` ON `annotations` (`span_id`) WHERE "annotations"."span_id" IS NOT NULL;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
