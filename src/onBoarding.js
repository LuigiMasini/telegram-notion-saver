import url from 'url'
import https from 'https'
import fs from 'fs'
import fetch from 'node-fetch'

import httpTerminator from 'http-terminator'

import bot, {Markup} from './bot.js'
import db from './db.js'
import debugLog from './debug.js'

const options = {
	key: fs.readFileSync(process.env.sslKeyFile),
	cert: fs.readFileSync(process.env.sslCertFile),
};

const redirect_uri = process.env.notionRedirectUri + ':' + process.env.port


function rfc6749ErrorMessageComposer(obj){
	//https://datatracker.ietf.org/doc/html/rfc6749#section-4.2.2.1
	//https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
	
	var additionalInfo = ""
	if (typeof obj.error === "string" && obj.error.length)
		additionalInfo="\n\nInfo from Noiton: \nError: "+obj.error
	if (typeof obj.error_description === "string" && obj.error_description.length)
		additionalInfo+="\nError description: "+obj.error_description
	if (typeof obj.error_uri === "string" && obj.error_uri.length)
		additionalInfo+="\nMore info: "+obj.error_uri
	return additionalInfo
}

var server = https.createServer(options, function(req, res) {
	
	function redirect(){
		//redirect user from browser to telegram chat with the bot
		res.writeHead(302, {'Location': 'https://t.me/NotionSaverBot'});
		res.end('Ciao');
	}
	
	try{
		const t = Date.now()
		
		const queryObject = url.parse(req.url,true).query;
		
		debugLog("Recived query from Notion authorization: ",queryObject)
		
		//if received state param from notion
		if ( typeof queryObject === "object" && typeof queryObject.state === "string" && queryObject.state.length && typeof parseInt(queryObject.state.slice(1 ,-1)) === "number" ){
			
			const chatId = parseInt(queryObject.state.slice(1 ,-1))
			
			//if received temporary authorization code
			if (typeof queryObject.code === "string" && queryObject.code.length){
				
				//get access token
				fetch("https://api.notion.com/v1/oauth/token", {
					method:'POST',
					headers: {
						'Authorization': 'Basic '+Buffer.from(process.env.notionOAuthClientId+':'+process.env.notionOAuthSecret).toString('base64'),
						'Accept': 'application/json',
						'Content-Type' : 'application/json',
					},
					body: JSON.stringify({
						grant_type:"authorization_code",
						redirect_uri: redirect_uri,
						code:queryObject.code,
					}),
				})
				.then(response=>{
					if (response.statusCode >= 400 ) 
						throw new Error("can't get access token from notion server: "+rfc6749ErrorMessageComposer(response.json()))
					return response
				})
				.then(response=>response.json())
				.then(response=>{
					debugLog("Notion token response: ",response)
					
					db.beginTransaction(errT=>{
						
						!!errT && debugLog(errT)
						
						//get TelegramChats.id
						const a = db.execute('SELECT id FROM `TelegramChats` WHERE telegramChatId = ? ', [chatId], (err1, res1)=>{
							
							!!err1 && debugLog(err1)
							
							debugLog(res1[0])
							
							if (!res1 || !res1.length)
								throw new Error("Can't find saved user information")
							
							//register workspace, 
							db.execute('INSERT INTO `NotionWorkspaces` (`workspaceId`, `creatorChatId`, `name`, `icon`) VALUES (?, ?, ?, ?)', [response.workspace_id, res1[0].id, response.workspace_name, response.workspace_icon], err2=>{
								
								/*Ignore ER_DUP_ENTRY: the workspace could be already registered by another user:
								* https://developers.notion.com/changelog/space-level-integrations-will-be-deprecated-soon-migrate-your-oauth-flows)*
								*/
								if (err2 && err2.code !== 'ER_DUP_ENTRY')
									throw new Error("Error registering workspace: "+err2.code+" - "+err2.sqlMessage)
								
								//get NotionWorkspaces.id of authorized workspace
								db.execute('SELECT id FROM `NotionWorkspaces` WHERE workspaceId = ?', [response.workspace_id], (err3, res3)=>{
									
									!!err3 && debugLog(err3)
									
									//register access token for authorized workspace
									db.execute('INSERT INTO `NotionWorkspacesCredentials` (`chatId`, `workspaceId`, `botId`, `accessToken`) VALUES (?, ?, ?, ?)', [res1[0].id, res3[0].id, response.bot_id, response.access_token], err4=>{
										
										if (err3 && err3.code !== 'ER_DUP_ENTRY')
											throw new Error("Error registering workspace: "+err3.code+" - "+err3.sqlMessage)
										
										//TODO: if user already have templates send different message
										const message = ()=>bot.telegram.sendMessage(chatId, "Good!\n\nNow you can set up a template with /configtemplates")
										
										//transaction did not start, we do not have to commit
										if (errT)
											message()
										else
											db.commit(errC=>{
												
												if (errC)
													throw new Error("Error committing changes: "+errC.code+" - "+errC.sqlMessage)
												
												message()
												debugLog("time elapsed: ", Date.now()-t)
											})
									})
								})
							})
						})
						
						console.log(a)
					})
				})
				.catch(err => {
					console.warn(err)
					bot.telegram.sendMessage(chatId, "Error setting up your account: "+err+"\n\nYou can try again later, search the error or report the incident.")
				})
			}
			else{
				
				console.warn("No tmp token from notion: "+rfc6749ErrorMessageComposer(queryObject))
				
				bot.telegram.sendMessage(chatId, "Did not receive temporary authorization code from Notion"+additionalInfo+"\n\nYou can try again later, search the error or report the incident on Github.")
			}
			
			
			redirect()
			
		}
	}catch(err){
		console.warn (err)
		redirect()
	}
	
	res.writeHead(400);
	res.end("Did not receive \'state\' query parameter from Notion\n\n"+
	"Is it your fault, fellow human?\n\n"+
	"You can try logging in again but I do not guarantee success:\n"+
	"Get back to <a href=\"https://t.me/NotionSaverBot?start\">https://t.me/NotionSaverBot</a>");
});

/*NOTE if server will take more than 5s to complete any request, 
 * add gracefulTerminationTimeout property to config object in createHttpTerminator
 * with the time taken by the server to complete requests in millis
 */
const serverTerminator = httpTerminator.createHttpTerminator({server})

const onBoardingServer = {
	start:((func)=>server.listen(process.env.port, func)),
	stop:(()=>serverTerminator.terminate()),//promise
	redirect_uri:redirect_uri,
}


export default onBoardingServer