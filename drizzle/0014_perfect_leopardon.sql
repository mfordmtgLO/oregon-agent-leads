CREATE TABLE `provider_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_open_id` varchar(64) NOT NULL,
	`provider` varchar(80) NOT NULL DEFAULT 'Big Purple Dot',
	`product` varchar(120),
	`connection_mode` varchar(32) NOT NULL DEFAULT 'not_configured',
	`base_url` text,
	`webhook_path` varchar(255),
	`territory_scope` varchar(255) DEFAULT 'Oregon',
	`historical_depth` varchar(64),
	`field_mapping_json` text,
	`pairing_threshold` int NOT NULL DEFAULT 3,
	`pairing_lookback_days` int NOT NULL DEFAULT 365,
	`enabled` boolean NOT NULL DEFAULT false,
	`readiness_status` varchar(32) NOT NULL DEFAULT 'needs_credentials',
	`last_sync_at` timestamp,
	`last_sync_status` varchar(32),
	`last_sync_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_connections_owner_open_id_unique` UNIQUE(`owner_open_id`)
);
--> statement-breakpoint
CREATE INDEX `provider_connections_owner_idx` ON `provider_connections` (`owner_open_id`);