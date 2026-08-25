CREATE TABLE `loan_officer_agent_pairings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`state` varchar(32) NOT NULL DEFAULT 'Oregon',
	`agent_id` int NOT NULL,
	`loan_officer_name` varchar(255) NOT NULL,
	`loan_officer_company` varchar(255),
	`loan_officer_nmls_id` varchar(64),
	`transaction_address` varchar(500),
	`transaction_closed_at` timestamp,
	`transaction_type` varchar(32),
	`source_url` text NOT NULL,
	`source_title` varchar(500),
	`evidence_note` text NOT NULL,
	`confidence` varchar(32) NOT NULL DEFAULT 'medium',
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`reviewed_at` timestamp,
	CONSTRAINT `loan_officer_agent_pairings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `loan_officer_agent_pairings_agent_idx` ON `loan_officer_agent_pairings` (`agent_id`);--> statement-breakpoint
CREATE INDEX `loan_officer_agent_pairings_state_idx` ON `loan_officer_agent_pairings` (`state`);