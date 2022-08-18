ALTER TABLE `NotionWorkspacesCredentials` DROP FOREIGN KEY NotionWorkspacesCredentials_ibfk_1;
ALTER TABLE `NotionWorkspacesCredentials` ADD FOREIGN KEY (`chatId`) REFERENCES `TelegramChats` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NotionWorkspacesCredentials` DROP FOREIGN KEY NotionWorkspacesCredentials_ibfk_2;
ALTER TABLE `NotionWorkspacesCredentials` ADD FOREIGN KEY (`workspaceId`) REFERENCES `NotionWorkspaces` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `NotionPages` DROP FOREIGN KEY NotionPages_ibfk_1;
ALTER TABLE `NotionPages` ADD FOREIGN KEY (`workspaceId`) REFERENCES `NotionWorkspaces` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NotionPages` DROP FOREIGN KEY NotionPages_ibfk_2;
ALTER TABLE `NotionPages` ADD FOREIGN KEY (`chatId`) REFERENCES `TelegramChats` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `NotionPagesProps` DROP FOREIGN KEY NotionPagesProps_ibfk_1;
ALTER TABLE `NotionPagesProps` ADD FOREIGN KEY (`pageId`) REFERENCES `NotionPages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NotionPagesProps` DROP FOREIGN KEY NotionPagesProps_ibfk_2;
ALTER TABLE `NotionPagesProps` ADD FOREIGN KEY (`propTypeId`) REFERENCES `NotionPropTypes` (`id`) ON UPDATE CASCADE;

ALTER TABLE `Templates` DROP FOREIGN KEY Templates_ibfk_1;
ALTER TABLE `Templates` ADD FOREIGN KEY (`pageId`) REFERENCES `NotionPages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Templates` DROP FOREIGN KEY Templates_ibfk_2;
ALTER TABLE `Templates` ADD FOREIGN KEY (`imageDestination`) REFERENCES `ImageDestinations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Templates` DROP FOREIGN KEY Templates_ibfk_3;
ALTER TABLE `Templates` ADD FOREIGN KEY (`chatId`) REFERENCES `TelegramChats` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TemplateRules` DROP FOREIGN KEY TemplateRules_ibfk_1;
ALTER TABLE `TemplateRules` ADD FOREIGN KEY (`propId`) REFERENCES `NotionPagesProps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `TemplateRules` DROP FOREIGN KEY TemplateRules_ibfk_2;
ALTER TABLE `TemplateRules` ADD FOREIGN KEY (`templateId`) REFERENCES `Templates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TemplateRules` DROP FOREIGN KEY TemplateRules_ibfk_3;
ALTER TABLE `TemplateRules` ADD FOREIGN KEY (`urlMetaTemplateRule`) REFERENCES `UrlMetaTemplateRules` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `UrlMetaTemplateRules` DROP FOREIGN KEY UrlMetaTemplateRules_ibfk_1;
ALTER TABLE `UrlMetaTemplateRules` ADD FOREIGN KEY (`imageDestination`) REFERENCES `ImageDestinations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `UrlMetaTemplateRules` DROP FOREIGN KEY UrlMetaTemplateRules_ibfk_2;
ALTER TABLE `UrlMetaTemplateRules` ADD FOREIGN KEY (`title`) REFERENCES `NotionPagesProps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `UrlMetaTemplateRules` DROP FOREIGN KEY UrlMetaTemplateRules_ibfk_3;
ALTER TABLE `UrlMetaTemplateRules` ADD FOREIGN KEY (`description`) REFERENCES `NotionPagesProps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `UrlMetaTemplateRules` DROP FOREIGN KEY UrlMetaTemplateRules_ibfk_4;
ALTER TABLE `UrlMetaTemplateRules` ADD FOREIGN KEY (`author`) REFERENCES `NotionPagesProps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `UrlMetaTemplateRules` DROP FOREIGN KEY UrlMetaTemplateRules_ibfk_5;
ALTER TABLE `UrlMetaTemplateRules` ADD FOREIGN KEY (`siteName`) REFERENCES `NotionPagesProps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `UrlMetaTemplateRules` DROP FOREIGN KEY UrlMetaTemplateRules_ibfk_6;
ALTER TABLE `UrlMetaTemplateRules` ADD FOREIGN KEY (`type`) REFERENCES `NotionPagesProps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `UrlMetaTemplateRules` DROP FOREIGN KEY UrlMetaTemplateRules_ibfk_7;
ALTER TABLE `UrlMetaTemplateRules` ADD FOREIGN KEY (`url`) REFERENCES `NotionPagesProps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
