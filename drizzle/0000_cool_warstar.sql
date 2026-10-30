CREATE TABLE `forecast_records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`symbol` text NOT NULL,
	`horizon` integer NOT NULL,
	`model_version` text NOT NULL,
	`as_of` text NOT NULL,
	`target` text NOT NULL,
	`created_at` text NOT NULL,
	`forecast_json` text NOT NULL,
	`actual_return` real,
	`settled_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forecast_identity` ON `forecast_records` (`owner_id`,`symbol`,`horizon`,`model_version`,`as_of`);--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`symbol` text NOT NULL,
	`quantity` real NOT NULL,
	`cost_basis` real NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `market_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`body` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`watchlist` text DEFAULT '["IBM"]' NOT NULL,
	`key_cipher` text,
	`daily_limit` integer DEFAULT 25 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `provider_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL
);
