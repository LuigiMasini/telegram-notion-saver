import { Telegraf, Markup } from 'telegraf'

import db from './db.js'
import onBoardingServer from './onBoarding.js'
import debugLog from './debug.js'
import notion from './notion.js'
import cache from './cache.js'

const bot = new Telegraf(process.env.telegramBotToken)

//TODO refactor entire file using scenes, composers, stages, sessions
//look	https://blog.logrocket.com/how-to-build-a-telegram-ocr-bot/
//and	https://telegraf.js.org/classes/MemorySessionStore.html

//TODO accorpare codice duplicato in funzioni

//TODO dare nomi meaningful a funzioni

function authorizeInNotion (ctx, again=false){
	
	const notionAuthorizationUrl = new URL ("https://api.notion.com/v1/oauth/authorize")
	
	notionAuthorizationUrl.searchParams.append("client_id", process.env.notionOAuthClientId)
	notionAuthorizationUrl.searchParams.append("redirect_uri", onBoardingServer.redirect_uri)
	notionAuthorizationUrl.searchParams.append("response_type", "code")
	notionAuthorizationUrl.searchParams.append("state", '"'+ctx.chat.id+'"')
	notionAuthorizationUrl.searchParams.append("owner", "user")
	
	return ctx.reply( (again ? "A" : "Fisrt thing, a")+"uthorize the integration in Notion and select which pages to make available to this bot",
		Markup.inlineKeyboard([
			Markup.button.url("Authorize in Notion", notionAuthorizationUrl),
		])
	)
}

bot.action('stopReauthorization', ctx=>
		ctx.answerCbQuery()
		.then(()=>ctx.editMessageText(ctx.callbackQuery.message.text))	//remove keyboard
		.then(()=>ctx.reply('nevermind'))
	  )

bot.action('continueReauthorization', ctx=>
		ctx.answerCbQuery()
		.then(()=>ctx.editMessageText(ctx.callbackQuery.message.text))	//remove keyboard
		.then(()=>authorizeInNotion(ctx, true))
	  )

bot.start(ctx=>{
	
	db.execute('INSERT INTO `TelegramChats` (`telegramChatId`,`chatType`) VALUES (?, ?)', [ctx.chat.id, ctx.chat.type], (err, res, fields)=>{
		
		if (err && err.code === 'ER_DUP_ENTRY')
			ctx.reply(
				"You are alredy registered, do you wish to autorize again?",
				Markup.inlineKeyboard([
					Markup.button.callback("Yes", "continueReauthorization"),
					Markup.button.callback("No", "stopReauthorization"),
				])
			)
		else {
			//NOTE probably there are other errors that should be handled, but 10911 sql errors to read in documentation is a bit too much  https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
			//finger crossed
			if (err)
				console.warn("Error registering telegram chat: "+err.code+" - "+err.sqlMessage)
			
			ctx.reply(
				"Hey There!\n"+
				"This is the most advanced (at the moment) Telegram to Notion bot.\n"+
				"It takes few steps to get it up and running.\n"+
				"Let's get started!"
			).then(authorizeInNotion(ctx))
		}
	})
	
})

bot.command('cancel', ctx=>cache.del(ctx.chat.id.toString()))

/*TODO
instead of 
 - message 1: Selected template : n
 - message 2: Changing Page
 - message 3: Selected Workspace : n
 etc 
 
 have message 1 with all that information, store its message_id in cache & modify it every time, add new information & needed buttons
 */
//TODO disposizioni e paginazione di pulsanti
//TODO cancellare cache a fine operazioni
//TODO add catch & error handling in every function
//### maybe add back button here and there in keyboards
//NOTE in cache.set all expansions in 'value' argument should go first, or they will overwrite changes, resulting in no change at all



bot.action(/setImageDestination(\d+)/i, ctx=>
		ctx.answerCbQuery()
		.then(() => ctx.editMessageText(ctx.callbackQuery.message.text))
		.then(() => {
			const data = cache.get(ctx.chat.id.toString())
			
			if (!data)
				return ctx.reply("We lost your cached data, please start the operation again.\n\nSorry for the incovenience")
			
			return db.promise('UPDATE `Templates` SET `ImageDestination`=? WHERE id=?', [ctx.match[1], data.templateData.id])
		})
		.then(({error}) => {
			if (!!error)
				throw new Error(error.code+" - "+error.sqlMessage)
			
			return ctx.reply("Done: now template "+data.templateData.userTemplateNumber+" is saving images to "+["content", "cover", "icon"][ctx.match[1]])
		})
		//WARNING tmp, if not op:edit will switch to adding text rules instead of getting back to selectTemplate
		.then(() => {
			
			const data = cache.get(ctx.chat.id.toString())
			
			if (!data)
				return ctx.reply("We lost your cached data, please start the operation again.\n\nSorry for the incovenience")
			
			cache.set(ctx.chat.id.toString(), {...data, op:'edit'})
			
			return selectTemplate(data.templateData.id, ctx)
		})
		.catch(err => {
			console.warn(err)
			ctx.reply("Error updating image destination: "+err+"\n\nYou can try again later, search the error or report the incident.")
		})
	  )


const editImageDestination = ctx => ctx.reply(
	"In which section of the page do you want me to save images you send me?",
	Markup.inlineKeyboard([
		Markup.button.callback("Content", 'setImageDestination0'),
		Markup.button.callback("Cover", 'setImageDestination1'),
		Markup.button.callback("Icon", 'setImageDestination2')
		//TODO add cancel button
	])
)

bot.action('editImageDestination', ctx =>
		ctx.answerCbQuery()
		.then(() => ctx.editMessageText(ctx.callbackQuery.message.text))
		.then(() => editImageDestination(ctx))
	  )

const selectPage = (pageId, ctx) => {
	
	const data = cache.get(ctx.chat.id.toString())
	
	if (!data)
		return ctx.reply("We lost your cached data, please start the operation again.\n\nSorry for the incovenience")
	
	const {pages, templateData, workspaceData, op, ...userData} = data
	
	const page = pages.filter( ({id}) => id === pageId)[0]
	
	//can always call editMessageText because selectPage is always called from bot.action
	return ctx.editMessageText("Selected page: "+page.title)
	.then(() => db.promise('UPDATE `Templates` SET pageId=? WHERE id=?', [page.id, templateData.id]))
	.then(({error}) => {
		
		if(!!error)
			throw new Error(error.code+" - "+error.sqlMessage)
		
		if (!!op && op === 'edit')
			return ctx.reply("All good: page for template "+templateData.userTemplateNumber+" set to "+page.title+" in workspace named "+workspaceData.name)
			.then(()=>selectTemplate(templateData.id, ctx))
		
		return editImageDestination(ctx)
	})	
}

bot.action(/selectPG(\d+)/i, ctx=>
		ctx.answerCbQuery()
		.then(()=>selectPage(parseInt(ctx.match[1]), ctx))
	  )

bot.action(/registerPG(\d+)/i, ctx=>{
	
	const data = cache.get(ctx.chat.id.toString())
	
	if (!data)
		return ctx.reply("We lost your cached data, please start the operation again.\n\nSorry for the incovenience")
	
	
	const {notionPages, pages, ...userData} = data
	
	const {id, icon, properties, object, title} = notionPages[parseInt(ctx.match[1])]
	
	const pageTitle = object === 'database' ? title[0].plain_text : notion.titleFromProps(properties)
	
	return db.promise(
		'INSERT INTO `NotionPages` (`pageType`, `workspaceId`, `notionPageId`, `icon`, `title`, `chatId`) VALUES (?, ?, ?, ?, ?, ?)',
		[object === "database" ? "db" : "pg", data.workspaceData.workspaceId, id, icon, pageTitle, data.templateData.chatId]
	)
	.then(()=>db.promise('SELECT MAX(id) as id, pageType, icon, title FROM NotionPages WHERE chatId=?', [data.templateData.chatId]))
	.then( ({result}) => result[0].pageType === "pg" ?
		({state:result}) :
		//cannot use db.promise ( === db.execute) cuz cannot bulk import with prepared statements, using db.promiseQuery ( === db.query )
		db.promiseQuery(
			   'INSERT INTO `NotionPagesProps` (`notionPropId`, `pageId`, `propName`, `propTypeId`) VALUES ?',
			   [Object.entries(properties).map( ([key, value]) => ([value.id, result[0].id, value.name, notion.propTypes.indexOf(value.type)]))],
			   result
			)
	)
	.then(({state})=>{
		
		cache.set(ctx.chat.id.toString(), {...userData, pages:state})
		
		return selectPage(state[0].id, ctx)
	})
	
})

bot.on(['text', 'edited_message'], (ctx, next)=>{
	
	const data = cache.get(ctx.chat.id.toString())
	
	if (!!data && !!ctx.message.reply_to_message && ctx.message.reply_to_message.message_id === data.message_id)
		
		return notion.client.search({
			auth:data.workspaceData.accessToken,
			query:ctx.message.text,
		}).then(res=>{
			
			if (!res.results.length)
				return ctx.reply('no results, search again or /cancel', Markup.forceReply())
				.then(({message_id})=>cache.set(ctx.chat.id.toString(), {...data, message_id}))
			else{
				
				cache.set(ctx.chat.id.toString(), {...data, notionPages:res.results})
				
				return ctx.reply(
					"Select a page:",
					Markup.inlineKeyboard(res.results.map(({id, object, title, properties}, key)=>{
						
						//TODO display pg.icon if emoji in button text
						//TODO display emoji if page or database (pg.pageType)
						
						const buttonTitle = object === 'database' ? title[0].plain_text : notion.titleFromProps(properties)
						
						return Markup.button.callback((key+1)+" - "+buttonTitle, "registerPG"+key)
					}))
				)
			}
		})
	else
		return next()
})

const addPage = ctx =>{
	
	const data = cache.get(ctx.chat.id.toString())
	
	if (!data)
		return ctx.reply("We lost your cached data, please start the operation again.\n\nSorry for the incovenience")
	
	return ctx.reply(
		"Reply to this message with the title of the page or database you would like to use in your template.\n\nNote: the page or database must exist and be shared with this integration.",
		Markup.forceReply()
		)
	.then(({message_id})=>cache.set(ctx.chat.id.toString(), {...data, message_id}))
}

bot.action('addPage', ctx=>
		ctx.answerCbQuery()
		.then(()=>ctx.editMessageText(ctx.callbackQuery.message.text))	//remove keyboard
		.then(()=>addPage(ctx))
	  )

const selectWorkspace = (workspaceId, ctx) => {
	
	const data = cache.get(ctx.chat.id.toString())
	
	if (!data)
		return ctx.reply("We lost your cached data, please start the operation again.\n\nSorry for the incovenience")
	
	const {workspaces, ...userData} = data
	
	const workspaceData = workspaces.filter(workspace =>workspace.workspaceId === workspaceId)[0]
	
	ctx.callbackQuery && ctx.callbackQuery.message.from.username === 'NotionSaverBot' && ctx.editMessageText("Selected Workspace : "+workspaceData.name)
	
	//check if user has any page
	return db.promise('SELECT id, pageType, icon, title FROM NotionPages WHERE chatId=?', [userData.templateData.chatId])
	.then(({result})=>{
		
		//keep just selected workspace & save pages
		cache.set(ctx.chat.id.toString(), {...userData, workspaceData, pages:result})
		
		if (!result.length)
			return addPage(ctx)
		else
			//TODO display pg.icon if emoji in button text
			//TODO display emoji if page or database (pg.pageType)
			return ctx.reply(
				"Select a page:",
				Markup.inlineKeyboard([
					...result.map(({id, title}, key)=>Markup.button.callback((key+1)+" - "+title, "selectPG"+id)),
					Markup.button.callback('+', 'addPage'),
				])
			)
		
	})
}

bot.action(/selectWK(\d+)/i, ctx=>
		ctx.answerCbQuery()
		.then(()=>selectWorkspace(parseInt(ctx.match[1]), ctx))
	  )

//cant define addWorkspace function as authorizeInNotion.then etc bc there is onBoarding before
//TODO pass templateId to authorizeInNotion, that saves it in state, then read it in onBoarding and after everything done call selectWorkspace to resume operation

bot.action('addWorkspace', ctx=>
		ctx.answerCbQuery()
		.then(()=>ctx.editMessageText(ctx.callbackQuery.message.text))	//remove keyboard
		.then(()=>authorizeInNotion(ctx))
	  )

const preSelectWorkspace = ctx => {
	
	const data = cache.get(ctx.chat.id.toString())
	
	if (!data)
		return ctx.reply("We lost your cached data, please start the operation again.\n\nSorry for the incovenience")
	
	const {templateData, ...userData} = data
	
	//check if user has any workspace
	return db.promise('SELECT wc.accessToken, wc.workspaceId, nw.name, nw.icon FROM NotionWorkspacesCredentials as wc LEFT OUTER JOIN NotionWorkspaces as nw ON nw.id=wc.workspaceId WHERE wc.chatId=?', [templateData.chatId])
	.then(({result})=>{
		
		//keep just the selected template & save workspaces
		cache.set(ctx.chat.id.toString(), {...data, workspaces:result})
		
		//if no workspaces authorized
		if (!result || !result.length)
			return ctx.reply("No workspace found. Add one then try again:")
			//TODO see preceding TODO
			.then(()=>authorizeInNotion(ctx))
			
		//select a workspace
		else
			//TODO display nw.icon if emoji in button text
			return ctx.reply(
				"Select a workspace:",
				Markup.inlineKeyboard([
					...result.map(({workspaceId, name}, key)=>Markup.button.callback((key+1)+" - "+name, "selectWK"+workspaceId)),
					Markup.button.callback('+', 'addWorkspace'),
					//TODO add cancel button
				])
			)
	})
}

bot.action('changePage',  ctx => 
		ctx.answerCbQuery()
		.then(()=>ctx.editMessageText("Changing template's page"))
		.then(()=>preSelectWorkspace(ctx))
	  )

bot.action('changeRule', ctx =>
		ctx.answerCbQuery()
		.then(()=>ctx.editMessageText("Editing rules"))
		.then(()=>ctx.reply(
			"Do you whant to edit what to do with image or text?",
			Markup.inlineKeyboard([
				Markup.button.callback('Image', 'editImageDestination'),
				Markup.button.callback('Text', 'editTextRules'),
				//NOTE will add audio & files
				//TODO add cancel button
			])
		))
	  )

const selectTemplate = (templateId, ctx) => {
	
	const data = cache.get(ctx.chat.id.toString())
	
	if (!data)
		return ctx.reply("We lost your cached data, please start the operation again.\n\nSorry for the incovenience")
	
	//get array of templates
	const {templates, ...userData} = data
	
	if (!!templates){
		const templateData = templates.filter(({id})=>id===templateId)[0]
		
		ctx.callbackQuery && ctx.callbackQuery.message.from.username === 'NotionSaverBot' && ctx.editMessageText("Selected Template : "+templateData.userTemplateNumber)
		
		cache.set(ctx.chat.id.toString(), {...userData, templateData})
		
		//if the selected template has NULL pageId automatically add it
		if (!templateData.pageId)
			return preSelectWorkspace(ctx)
	}
	
	if (!!userData.op && userData.op === "edit")
		return ctx.reply(
			//TODO insert here current template configuration"
			"What do you want to do?",
			Markup.inlineKeyboard([
				Markup.button.callback("Change page", 'changePage'),
				Markup.button.callback("Change rules", 'changeRule'),
				//TODO cancel button
			]))
	
	return preSelectWorkspace(ctx)
}

bot.action(/selectTP(\d+)/i, ctx=>{
	
	const data = cache.get(ctx.chat.id.toString())
	
	if (!data)
		return ctx.reply("We lost your cached data, please start the operation again.\n\nSorry for the incovenience")
	
	cache.set(ctx.chat.id.toString(), {...data, op:'edit'})
	
	return ctx.answerCbQuery()
	.then(()=>selectTemplate(parseInt(ctx.match[1]), ctx))
})

const addTemplate = ctx =>{
	
	const data = cache.get(ctx.chat.id.toString())
	
	if (!data)
		return ctx.reply("We lost your cached data, please start the operation again.\n\nSorry for the incovenience")
	
	const {templates} = data
	
	const userTemplateNumber = !templates.length ? 0 : templates[templates.length-1].userTemplateNumber+1
	
	return db.promise('SELECT id FROM TelegramChats WHERE telegramChatId=?', [ctx.chat.id])
	.then(({result})=>db.promise('INSERT INTO Templates (`userTemplateNumber`, `chatId`) VALUES (?, ?)', [userTemplateNumber, result[0].id], {id:result[0].id}))
	.then(({state})=>db.promise('SELECT MAX(id) as id, userTemplateNumber, chatId FROM Templates WHERE chatId=?', [state.id]))
	.then(({result})=>{
		
		//set array of templates, just one
		cache.set(ctx.chat.id.toString(), {templates:result})	//NOTE result is already an array thanks to MAX
		
		return selectTemplate(result[0].id, ctx)
	})
}

bot.action('addTemplate', ctx=>
		ctx.answerCbQuery()
		.then(()=>ctx.editMessageText(ctx.callbackQuery.message.text))	//remove keyboard
		.then(()=>addTemplate(ctx))
	  )

bot.command('configtemplates', ctx=>
	//get user templates
// 	db.promise('SELECT t.id, t.userTemplateNumber, p.pageType, p.icon, tc.id as chatId FROM Templates as t LEFT OUTER JOIN NotionPages as p ON p.id=t.pageId LEFT OUTER JOIN TelegramChats as tc ON tc.id = p.chatId WHERE tc.telegramChatId=? ORDER BY t.userTemplateNumber',[ctx.chat.id])
	//WARNING tmp to not create a new template every time the operation will not  conclude
	db.promise('SELECT t.id, t.userTemplateNumber, tc.id as chatId, t.pageId FROM Templates as t LEFT OUTER JOIN TelegramChats as tc ON tc.id = t.chatId WHERE tc.telegramChatId=? ORDER BY t.userTemplateNumber',[ctx.chat.id])
	.then(({result})=>{
		
		

		//set array of templates 
		cache.set(ctx.chat.id.toString(), {templates:result})
		
		//if no templates add one:
		if (!result.length)
			return ctx.reply("No existing template found, adding a new one")
			.then(()=>addTemplate(ctx))
		
		//choose between existing templates & add button
		else
			//TODO display p.icon if emoji in button text
			//TODO display emoji if page or database (p.pageType)
			return ctx.reply(
				"Select a template to edit",
				Markup.inlineKeyboard([
					...result.map(({id, userTemplateNumber}, key)=>Markup.button.callback(userTemplateNumber, "selectTP"+id)),
					Markup.button.callback('+', 'addTemplate'),
					//TODO add cancel button
				])
			)
	})
)


export default bot
export {Markup}