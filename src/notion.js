import { Client as NotionClient } from "@notionhq/client"

import db from './db.js'
import debugLog from './debug.js'

//creating a single NotionClient for every user
//do not set a global token but pass it as parameter to every endpoint method
//2021-09-21 it is an undocumented method parameter, could break ¯\_(ツ)_/¯

const notion = new NotionClient()


function passAccessToken (func, argObj){
	return db.execute('SELECT accessToken FROM `WorkspacesCredentials`WHERE chatId=? AND workspaceId=?', [argObj.chatId, argObj.workspaceId], (err, res)=>{
		
		!!err && debugLog(err)
		
		func({accessToken:res[0].accessToken, ...argObj})
	})
}

function addPageOperation ({accessToken, chatId, notionPageId}){
	
	notion.pages.retrieve({
		auth:accessToken,
		page_id:notionPageId,
	})
	.then(response=>{
		
		const {id, object, properties, icon} = response.results[0]
		
		db.execute('INSERT INTO `NotionPages` (`pageType`, `workspaceId`, `notionPageId`) VALUES (?, ?, ? )', [], (err, res)=>{
			!!err && debugLog(errT)
			
			
		})
	})
}

export default notion
export {
	addPage:(argObj=>passAccessToken(addPageOperation, argObj)),
}