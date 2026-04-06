CREATE TABLE `audit_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(30),
	`businessName` text NOT NULL,
	`placeId` varchar(256),
	`healthScore` int,
	`responseRate` int,
	`totalReviews` int,
	`averageRating` varchar(10),
	`convertedToClient` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_leads_id` PRIMARY KEY(`id`)
);
