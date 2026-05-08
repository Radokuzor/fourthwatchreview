CREATE TABLE `ai_audit_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`industryId` varchar(64) NOT NULL,
	`industryName` varchar(128) NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`businessName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(30),
	`websiteUrl` varchar(512),
	`answers` json NOT NULL,
	`aiReport` text,
	`reportError` text,
	`bookedMeeting` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_audit_submissions_id` PRIMARY KEY(`id`)
);
