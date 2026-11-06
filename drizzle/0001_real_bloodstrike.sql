CREATE TABLE `paper_accounts` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`cash_cents` integer DEFAULT 10000000 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`benchmark_adjusted` real NOT NULL,
	`benchmark_date` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `paper_trades` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`request_id` text NOT NULL,
	`account_version` integer NOT NULL,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`quantity_units` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`price_date` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `paper_order_identity` ON `paper_trades` (`owner_id`,`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `paper_account_sequence` ON `paper_trades` (`owner_id`,`account_version`);