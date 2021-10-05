# telegram-notion-saver
Telegram bot to save content to notion database

## Yet Another?

Yes, but this bot is both very flexible and powerful: from a single message it can fill
properties and content of a new database page, so that you no longer have to come back 
later to notion and adjust the saved content. Just set the rules once.

## How it works

First you '''/start''' the bot, it will show you a brief version ofthis guide. 
You will have to authorize the bot as a public integration in Notion, grant access to your workspace and select as many pages as you want.

Then you will have to '''/config''' a template: it is just a collection of rules on how the bot will read and split the information in the messages you send to it,
and where to put these informations, like properties, content or even icon or cover for images. You can also configure the extraction of metatata from one or more urls.
You can even configure default values for properties or content.

You can also configure more than one templates (set of rules) to be able to switch quickly between pages, databases and rules.
You can switch between templates with chat buttons or with '''/use n''' where n is template number.

## Future improvements

- Multiple workspaces for users
- Workspaces & templates can be shared between users