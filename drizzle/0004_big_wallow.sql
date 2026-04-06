CREATE TABLE `demo_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(30),
	`businessName` text NOT NULL,
	`reviewText` text,
	`reviewerName` varchar(255),
	`rating` int,
	`demoResponse` text,
	`decision` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
	`decidedAt` bigint,
	`expiresAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `demo_approvals_id` PRIMARY KEY(`id`),
	CONSTRAINT `demo_approvals_token_unique` UNIQUE(`token`)
);
