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
	`icon` CHAR(255),
	`chatId` INT UNSIGNED NOT NULL,			-- -> TelegramChats.id
	`title` CHAR(255),
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

INSERT IGNORE INTO NotionPropTypes VALUES (0, "title"), (1, "rich_text"), (2, "number"), (3, "select"), (4, "multi_select"), (5, "date"), (6, "people"), (7, "files"), (8, "checkbox"), (9, "url"), (10, "email"), (11, "phone_number"), (12, "formula"), (13, "relation"), (14, "rollup"), (15, "created_time"), (16, "created_by"), (17, "last_edited_time"), (18, "last_edited_by");
UPDATE NotionPropTypes SET id = 0 WHERE id = 20;	-- title will be inserted with id 20 instead of 0

-- Table containing templates informations

CREATE TABLE IF NOT EXISTS Templates (
	`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
	`pageId` INT UNSIGNED NULL,			-- -> NotionPages.id
	`userTemplateNumber` TINYINT UNSIGNED NOT NULL,
	`imageDestination` TINYINT UNSIGNED NULL,	-- -> ImageDestinations.id
	`chatId` INT UNSIGNED NOT NULL,			-- -> TelegramChats.id
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
	`propId` INT UNSIGNED,				-- -> NotionPagesProps.id, if NOT NULL extracted portion of message will be put in this prop, else if url follow urlMetaRule, else discard i
	`templateId` INT UNSIGNED NOT NULL,		-- -> Templates.id
	`orderNumber` TINYINT UNSIGNED,
	`defaultValue` CHAR(255),
	`endsWith` CHAR(255),				-- termination string for extraction, if NULL use defaultValue instead of extracting, if \n to  avoid breaking output use  replace(endsWith, '\n', '\\n') as endsWith
	`urlMetaTemplateRule` INT UNSIGNED NULL		-- -> UrlMetaTemplateRules.id
) ENGINE=InnoDB;


-- Table containing rules for URL meta extraction, in what propId to put the extracted content (if NULL discard)

CREATE TABLE IF NOT EXISTS UrlMetaTemplateRules (
	`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
	`imageDestination` TINYINT UNSIGNED NULL,	-- -> ImageDestinations.id
	`title` INT UNSIGNED,				-- -> NotionPagesProps.id
	`description` INT UNSIGNED,			-- -> NotionPagesProps.id
	`author` INT UNSIGNED,				-- -> NotionPagesProps.id
	`siteName` INT UNSIGNED,			-- -> NotionPagesProps.id
	`type` INT UNSIGNED,				-- -> NotionPagesProps.id
	PRIMARY KEY (`id`)
) ENGINE=InnoDB;
