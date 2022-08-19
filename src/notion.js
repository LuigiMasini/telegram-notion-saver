import { Client as NotionClient } from "@notionhq/client"

import db from './db.js'
import debugLog from './debug.js'

// https://stackoverflow.com/a/7033662
const chunkString = (str, length) => str.match(new RegExp(`(.|[\r\n]){1,${length}}`, 'g')) || ['\n'];

//creating a single NotionClient for every user
//do not set a global token but pass it as parameter to every endpoint method
//2021-09-21 it is an undocumented method parameter, could break ¯\_(ツ)_/¯

const notion = new NotionClient()

function getAccessToken (telegramChatId, workspaceId){
	return db.promiseExecute('SELECT accessToken FROM `NotionWorkspacesCredentials` as n JOIN `TelegramChats` as t on n.chatId = t.id WHERE workspaceId=? AND telegramChatId=?', [telegramChatId, workspaceId])
}

function mapValueToPropObj (inputValue, propType){

	let value = {}

	switch (propType){
		case 'title':
			value=[{
				type:'text',
				text:{
					content:inputValue
				}
			}]
			break;
		case 'rich_text':
			value=[{
				type:"text",
				//plain_text:inputValue
				text: {
					content:inputValue
				}
			}]
			break;
		case 'number':
			value=parseFloat(inputValue)
			break;
		case 'select':
			value={
				name:inputValue
			}
			break;
		case 'multi_select':
			value=inputValue.split(',').map(str=>({name:str.trim()}))
			break;
		case 'date':
			const arr = inputValue.split(',').map(str=>{
				const millis = Date.parse(str)
				if (isNaN(millis))
					throw new Error ("Cannot parse date "+str+"\nPlease use a different format")
					return new Date(millis).toISOString()
			})
			value={
				start:arr[1],
				end:arr[2]
			}
			break;
		case 'checkbox':
			value= !!inputValue
			break;
		case 'url':
		case 'email':
		case 'phone_number':
			value=inputValue
			break;
	}

	return value
}


function mapValueToBlockObjs (inputValue, blockType){

	let value = {}

	switch (blockType){
		case 'text':


			const textBlocks = inputValue
			.split('\n')
			.map(string => chunkString(string, 2000))
			.flat()
			.map(str => ({
				type: "text",
				text: {
					content: str,
				},
			}))

			const paragraphs = []
			const chunkSize = 100

			//https://stackoverflow.com/a/8495740
			for (let i=0; i<textBlocks.length; i += chunkSize) {

				const chunk = textBlocks.slice(i, i + chunkSize);
				paragraphs.push({
					object: "block",
					type: "paragraph",
					paragraph: {
						text:chunk,
					}
				})
			}

			value=paragraphs;

			break
		case 'image':
			value = {
				object: "block",
				type: "image",
				image: {
					type: "external",
					external: {
						url: inputValue
					}
				}
			}
			break
	}

	return value
}

const exportObj = {
	getAccessToken,
	client:notion,
	titleFromProps:((properties)=>Object.entries(properties).filter( ([key, value]) => value.type === 'title')[0][1].title[0].plain_text), //NOTE works only for pages
	propTypes:["title","rich_text","number","select","multi_select","date","people","files","checkbox","url","email","phone_number","formula","relation","rollup","created_time","created_by","last_edited_time","last_edited_by"],
	supportedTypes:[0, 1, 2, 3, 4, 5, 8, 9, 10, 11, null],
	mapValueToPropObj,
	mapValueToBlockObjs,
}

export default exportObj
