CREATE TABLE `pairing_discovery_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_open_id` varchar(64) NOT NULL,
	`state` varchar(32) NOT NULL DEFAULT 'Oregon',
	`schedule_cron_task_uid` varchar(65),
	`cron_expression` varchar(64) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`lookback_days` int NOT NULL DEFAULT 365,
	`custom_start_at` timestamp,
	`custom_end_at` timestamp,
	`last_run_at` timestamp,
	`last_run_started_at` timestamp,
	`last_run_completed_at` timestamp,
	`last_run_status` varchar(32),
	`last_run_pairings_created` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pairing_discovery_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `pairing_discovery_schedules_owner_open_id_unique` UNIQUE(`owner_open_id`),
	CONSTRAINT `pairing_discovery_schedules_schedule_cron_task_uid_unique` UNIQUE(`schedule_cron_task_uid`)
);
--> statement-breakpoint
CREATE INDEX `pairing_discovery_task_uid_idx` ON `pairing_discovery_schedules` (`schedule_cron_task_uid`);