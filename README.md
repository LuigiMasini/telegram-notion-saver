# telegram-notion-saver
Telegram bot to save content to notion database

You can check it out at [t.me/NotionSaverBot](https://t.me/NotionSaverBot)

> **Still a Work In Progress**

## Showcase


https://user-images.githubusercontent.com/51889753/160253052-4a29213e-a019-47f4-9e7d-ddf7af2eeade.mp4


## Yet Another?

Yes, but this bot is both very flexible and powerful: from a single message it can fill
properties and content of a new database page, so that you no longer have to come back 
later to notion and adjust the saved content. Just set the rules once.

> **IMPORTANT**
> currently only has good supports for adding pages to a database
> 
> adding block to pages works but not very flexible, if you find it not suitable for you send a pull request or switch to another telegram to notion bot

## How it works

First you ```/start``` the bot.
You will have to authorize the bot as a public integration in Notion, grant access to your workspace and select as many pages as you want.


https://user-images.githubusercontent.com/51889753/160253172-7f5d7c44-986b-4e13-a210-f7760fe5ae3e.mp4


Then you will have to ```/config``` a template: it is just a collection of rules on how the bot will read and split the information in the messages you send to it,
and where to put these informations, like properties, content or even icon or cover for images. You can also configure the extraction of metatata from one or more urls.
You can even configure default values for properties or content.


https://user-images.githubusercontent.com/51889753/160253257-c9b30666-12d3-4926-9400-7ad37bf0e792.mp4


You can also configure more than one templates (set of rules) to be able to switch quickly between pages, databases and rules.
You can switch between templates with chat buttons or with ```/use n``` where n is template number.

## Future improvements

- documentation & guides
- Workspaces & templates can be shared between users
- support for images, files, audio, stikers, video, etc
- support for url buttons in forwarded messages
- multiple templates active at the same time, automatically determine which one to use looking at formats, link domains, forwarded from, is / contains file
- a template can modify multiple pages (save same content to more than one location with more than one rule)
- in TemplateRule have different order for parsing and writing (may be useful when writing blocks)
- add possibility to add a sub page block with certain title and content
- regex support for text splitting (instead of endsWith) and text filtering, like having ABC and you want AC in a prop
- more freedom in content

> **Still a Work In Progress**
