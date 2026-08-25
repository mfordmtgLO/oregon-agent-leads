ALTER TABLE `loan_officer_agent_pairings` ADD `loan_officer_phone` varchar(64);--> statement-breakpoint
ALTER TABLE `loan_officer_agent_pairings` ADD `loan_officer_email` varchar(320);--> statement-breakpoint
ALTER TABLE `loan_officer_agent_pairings` ADD `loan_officer_headshot_url` text;--> statement-breakpoint
ALTER TABLE `loan_officer_agent_pairings` ADD `shared_transaction_count` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `loan_officer_agent_pairings` ADD `total_shared_loan_volume` double;--> statement-breakpoint
ALTER TABLE `loan_officer_agent_pairings` ADD `first_shared_close` timestamp;--> statement-breakpoint
ALTER TABLE `loan_officer_agent_pairings` ADD `latest_shared_close` timestamp;--> statement-breakpoint
ALTER TABLE `loan_officer_agent_pairings` ADD `match_method` varchar(64) DEFAULT 'manual' NOT NULL;