import { Client as NotionClient } from "@notionhq/client"

import db from './db.js'
import debugLog from './debug.js'

//creating a single NotionClient for every user
//do not set a global token but pass it as parameter to every endpoint method
//2021-09-21 it is an undocumented method parameter, could break ¯\_(ツ)_/¯

const notion = new NotionClient()

function getAccessToken (telegramChatId, workspaceId){
	return db.promiseExecute('SELECT accessToken FROM `NotionWorkspacesCredentials` as n JOIN `TelegramChats` as t on n.chatId = t.id WHERE workspaceId=? AND telegramChatId=?', [telegramChatId, workspaceId])
}

const exportObj = {
	getAccessToken,
	client:notion,
	titleFromProps:((properties)=>Object.entries(properties).filter( ([key, value]) => value.type === 'title')[0][1].title[0].plain_text), //NOTE works only for pages
	propTypes:["title","rich_text","number","select","multi_select","date","people","files","checkbox","url","email","phone_number","formula","relation","rollup","created_time","created_by","last_edited_time","last_edited_by"],
	supportedTypes:[0, 1, 2, 3, 4, 5, 8, 9, 10, 11, null],
}

export default exportObj
