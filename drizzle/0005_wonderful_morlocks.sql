CREATE TABLE `user_audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`email` varchar(320),
	`placeId` varchar(256) NOT NULL,
	`businessName` varchar(255) NOT NULL,
	`auditJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_audits_id` PRIMARY KEY(`id`)
);
