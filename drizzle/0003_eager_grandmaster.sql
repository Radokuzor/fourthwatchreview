ALTER TABLE `audit_leads` ADD `verificationCode` varchar(10);--> statement-breakpoint
ALTER TABLE `audit_leads` ADD `verified` boolean DEFAULT false NOT NULL;