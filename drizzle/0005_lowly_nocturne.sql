CREATE TABLE `verification_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`state` varchar(32) NOT NULL DEFAULT 'Oregon',
	`schedule_cron_task_uid` varchar(65),
	`cron_expression` varchar(64) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`last_run_at` timestamp,
	`last_run_id` int,
	`last_notification_sent_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `verification_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `verification_schedules_name_unique` UNIQUE(`name`),
	CONSTRAINT `verification_schedules_schedule_cron_task_uid_unique` UNIQUE(`schedule_cron_task_uid`)
);
--> statement-breakpoint
CREATE INDEX `verification_schedules_task_uid_idx` ON `verification_schedules` (`schedule_cron_task_uid`);