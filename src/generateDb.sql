CREATE DATABASE IF NOT EXISTS `telegram-notion-saver` CHARACTER SET = utf8;
use telegram-notion-saver;

-- Table containing chats info (not users cuz the bot can be added to a grout chat)

CREATE TABLE IF NOT EXISTS TelegramChats (
	`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
	`telegramChatId` CHAR(10) NOT NULL UNIQUE,	-- it has at most 52 significant bits
	`currentTemplateId` INT UNSIGNED NULL,		-- -> Templates.id
	`chatType` ENUM("private", "group", "supergroup", "channel"),
	PRIMARY KEY (`id`)
) ENGINE=InnoDB;


-- Table containing notion workspaces

CREATE TABLE IF NOT EXISTS NotionWorkspaces (
	`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
	`creatorChatId` INT UNSIGNED NOT NULL,		-- -> TelegramChats.id
	`workspaceId` CHAR(36) NOT NULL UNIQUE,
	`name` CHAR(255),
	`icon` CHAR(255),
	PRIMARY KEY (`id`)
) ENGINE=InnoDB;


-- Table containing notion workspaces access tokens

CREATE TABLE IF NOT EXISTS NotionWorkspacesCredentials (
	`chatId` INT UNSIGNED NOT NULL,			-- -> TelegramChats.id
	`workspaceId` INT UNSIGNED NOT NULL,		-- -> NotionWorkspaces.id
	`botId` CHAR(36) NOT NULL,
	`accessToken` CHAR(255) NULL UNIQUE
) ENGINE=InnoDB;

-- Table containing notion pages or databases UUIDv4 (36 character)

CREATE TABLE IF NOT EXISTS NotionPages (
	`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
	`notionPageId` CHAR(36) NOT NULL,
	`workspaceId` INT UNSIGNED NOT NULL,		-- -> NotionWorkspaces.id
	`pageType` ENUM("db", "pg") NULL,
-- TODO	`icon`
	PRIMARY KEY (`id`)
) ENGINE=InnoDB;


-- Table containing props for each db in NotionPages

CREATE TABLE IF NOT EXISTS NotionPagesProps (
	`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
	`notionPropId` CHAR(255),			-- if NULL not a prop but page content
	`pageId` INT UNSIGNED NOT NULL,			-- -> NotionPages.id
	`propName` CHAR(255) NULL,
	`propTypeId` INT UNSIGNED,			-- -> NotionPropTypes.id, if NULL not a prop but page content
	PRIMARY KEY (`id`)
) ENGINE=InnoDB;


-- Table containing notion's prop types

CREATE TABLE IF NOT EXISTS NotionPropTypes (
	`id` TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`type` CHAR(16) NOT NULL UNIQUE,
	PRIMARY KEY (`id`)
);

INSERT IGNORE INTO NotionPropTypes (`type`) VALUES ("title"), ("rich_text"), ("number"), ("select"), ("multi_select"), ("date"), ("people"), ("files"), ("checkbox"), ("url"), ("email"), ("phone_number"), ("formula"), ("relation"), ("rollup"), ("created_time"), ("created_by"), ("last_edited_time"), ("last_edited_by");


-- Table containing templates informations

CREATE TABLE IF NOT EXISTS Templates (
	`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
	`pageId` INT UNSIGNED NULL,			-- -> NotionPages.id
	`userTemplateNumber` TINYINT UNSIGNED NOT NULL,
	`imageDestination` TINYINT UNSIGNED NULL,	-- -> ImageDestinations.id
	PRIMARY KEY (`id`)
) ENGINE=InnoDB;


-- Table containing possible destinations for an extracted image

CREATE TABLE IF NOT EXISTS ImageDestinations(
	`id` TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`destinations` CHAR(10) NOT NULL,
	PRIMARY KEY (`id`)
);

INSERT INTO ImageDestinations (`destinations`) VALUES ("content"), ("cover"), ("icon");


-- Table containing template rules

CREATE TABLE IF NOT EXISTS TemplateRules (
	`propId` INT UNSIGNED,				-- -> NotionPagesProps.id, if NOT NULL extracted portion of message will be put in this prop, else discard it
	`templateId` INT UNSIGNED NOT NULL,		-- -> Templates.id
	`orderNumber` TINYINT UNSIGNED,			-- if NULL put defaultValue instead of extracting from message
	`defaultValue` CHAR,
	`endsWith` CHAR,				-- termination string for extraction
	`urlMetaTemplateRule` INT UNSIGNED		-- -> UrlMetaTemplateRules.id
) ENGINE=InnoDB;


-- Table containing rules for URL meta extraction, in what propId to put the extracted content (if NULL discard)

CREATE TABLE IF NOT EXISTS UrlMetaTemplateRules (
	`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
	`imageDestination` TINYINT UNSIGNED NULL,	-- -> ImageDestinations.id
	`url` INT UNSIGNED,				-- -> NotionPagesProps.id
	`title` INT UNSIGNED,				-- -> NotionPagesProps.id
	`description` INT UNSIGNED,			-- -> NotionPagesProps.id
	`author` INT UNSIGNED,				-- -> NotionPagesProps.id
	`siteName` INT UNSIGNED,			-- -> NotionPagesProps.id
	`type` INT UNSIGNED,				-- -> NotionPagesProps.id
	PRIMARY KEY (`id`)
) ENGINE=InnoDB;
