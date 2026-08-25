ALTER TABLE `loan_officer_agent_pairings` ADD `loan_type` varchar(64);--> statement-breakpoint
ALTER TABLE `loan_officer_agent_pairings` ADD `interest_rate` double;--> statement-breakpoint
ALTER TABLE `loan_officer_agent_pairings` ADD `loan_amount` double;--> statement-breakpoint
ALTER TABLE `loan_officer_agent_pairings` ADD `purchase_price` double;--> statement-breakpoint
ALTER TABLE `loan_officer_agent_pairings` ADD `property_zillow_url` text;--> statement-breakpoint
ALTER TABLE `property_transactions` ADD `purchase_price` double;--> statement-breakpoint
ALTER TABLE `property_transactions` ADD `interest_rate` double;--> statement-breakpoint
ALTER TABLE `property_transactions` ADD `loan_type` varchar(64);--> statement-breakpoint
ALTER TABLE `property_transactions` ADD `property_zillow_url` text;