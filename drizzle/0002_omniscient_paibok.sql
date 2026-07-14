ALTER TABLE `agents` ADD `principalBrokerName` varchar(255);--> statement-breakpoint
ALTER TABLE `agents` ADD `principalBrokerTitle` varchar(255);--> statement-breakpoint
ALTER TABLE `agents` ADD `principalBrokerPhone` varchar(64);--> statement-breakpoint
ALTER TABLE `agents` ADD `principalBrokerEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `agents` ADD `principalBrokerHeadshotUrl` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `officeBuysideTransactions` int;--> statement-breakpoint
ALTER TABLE `agents` ADD `officeBuysideRank` int;--> statement-breakpoint
ALTER TABLE `agents` ADD `officeEstimationNotes` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `officeDataConfidence` varchar(32);--> statement-breakpoint
ALTER TABLE `agents` ADD `officeDataSources` text;