CREATE TABLE `approval_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewResponseId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`action` enum('approve','reject') NOT NULL,
	`expiresAt` bigint NOT NULL,
	`usedAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `approval_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `brand_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`businessContext` text,
	`brandVoice` text,
	`toneGuidelines` text,
	`responseTemplates` json,
	`avoidPhrases` text,
	`mustIncludePhrases` text,
	`languagePreference` varchar(16) DEFAULT 'en',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_templates_clientId_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`businessName` varchar(255) NOT NULL,
	`contactEmail` varchar(320),
	`telegramChatId` varchar(64),
	`notifyTelegram` boolean NOT NULL DEFAULT true,
	`notifyEmail` boolean NOT NULL DEFAULT true,
	`approvalEmail` varchar(320),
	`subscriptionStatus` enum('trial','active','paused','cancelled') NOT NULL DEFAULT 'trial',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`locationName` varchar(255) NOT NULL,
	`address` text,
	`googleAccountId` varchar(128),
	`googleLocationId` varchar(255),
	`onboardingPath` enum('manager','oauth') NOT NULL DEFAULT 'manager',
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` bigint,
	`managerEmail` varchar(320),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastPolledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewId` int NOT NULL,
	`aiDraftResponse` text,
	`finalResponse` text,
	`status` enum('draft','pending_approval','approved','posted','rejected','manual_needed') NOT NULL DEFAULT 'draft',
	`approvedAt` bigint,
	`postedAt` bigint,
	`rejectedAt` bigint,
	`rejectedReason` text,
	`telegramMessageId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `review_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_responses_reviewId_unique` UNIQUE(`reviewId`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationId` int NOT NULL,
	`googleReviewId` varchar(255) NOT NULL,
	`reviewerName` varchar(255),
	`reviewerPhotoUrl` text,
	`rating` int NOT NULL,
	`comment` text,
	`publishedAt` bigint,
	`status` enum('new','processing','pending_approval','approved','posted','rejected','manual') NOT NULL DEFAULT 'new',
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_googleReviewId_unique` UNIQUE(`googleReviewId`)
);
