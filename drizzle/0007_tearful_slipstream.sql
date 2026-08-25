CREATE TABLE `property_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`state` varchar(32) NOT NULL DEFAULT 'Oregon',
	`county_fips` varchar(5),
	`county` varchar(120),
	`apn` varchar(80),
	`standardized_address` varchar(500),
	`recording_date` timestamp NOT NULL,
	`sale_price` double,
	`loan_amount` double,
	`lender_name` varchar(255),
	`buyer_name` varchar(255),
	`seller_name` varchar(255),
	`buyer_agent_license` varchar(64),
	`buyer_agent_name` varchar(255),
	`loan_officer_nmls` varchar(64),
	`loan_officer_name` varchar(255),
	`source_type` varchar(64) NOT NULL,
	`source_url` text,
	`source_record_id` varchar(255),
	`raw_payload` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `property_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `property_transactions_recording_date_idx` ON `property_transactions` (`recording_date`);--> statement-breakpoint
CREATE INDEX `property_transactions_apn_idx` ON `property_transactions` (`apn`);--> statement-breakpoint
CREATE INDEX `property_transactions_pair_idx` ON `property_transactions` (`buyer_agent_license`,`loan_officer_nmls`);