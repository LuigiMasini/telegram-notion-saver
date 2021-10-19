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

bot.start(ctx=>
	db.promiseExecuteq('INSERT INTO `TelegramChats` (`telegramChatId`,`chatType`) VALUES (?, ?)', [ctx.chat.id, ctx.chat.type])
	.then(({error, result})=>{
		
		if (error && error.code === 'ER_DUP_ENTRY')
			return ctx.reply(
				"You are alredy registered, do you wish to autorize again?",
				Markup.inlineKeyboard([
					Markup.button.callback("Yes", "continueReauthorization"),
					Markup.button.callback("No", "stopReauthorization"),
				])
			)
		
		//NOTE probably there are other errors that should be handled, but 10911 sql errors to read in documentation is a bit too much  https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
		//finger crossed
		if (!!error)
			throw new Error("Error registering telegram chat: "+err.code+" - "+err.sqlMessage)
		
		return ctx.reply(
			"Hey There!\n"+
			"This is the most advanced (at the moment) Telegram to Notion bot.\n"+
			"It takes few steps to get it up and running.\n"+
			"Let's get started!"
		)
		.then(()=>authorizeInNotion(ctx))
		
	})
	.catch(err=>{
		console.warn(err)
		return ctx.reply(err)
	})
	
)

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

const setTextRules = (ctx) => {
	const data = cache.get(ctx.chat.id.toString())
	
	if (!data || ( !data.templateData.pageId && !data.pageData.id) )
		return ctx.editMessageText("We lost your cached data, please start the operation again.\n\nSorry for the incovenience")
	
	
	//### maybe in future will have rules in a notion db the user share with the bot
	
	return db.promiseExecute(
		'SELECT * FROM `NotionPagesProps` WHERE pageId=?',
		[data.templateData.pageId || data.pageData.id]		//if op:edit from template, if adding template from page
	)
	.then(({result}) => db.promiseExecute(
			'SELECT tr.orderNumber, pp.propName, tr.endsWith, tr.defaultValue, tr.urlMetaTemplateRule, u.title, u.imageDestination, u.siteName, u.description, u.type, u.author FROM `TemplateRules` AS tr LEFT OUTER JOIN `NotionPagesProps` AS pp ON pp.id = tr.propId LEFT OUTER JOIN `UrlMetaTemplateRules` AS u ON u.id = tr.urlMetaTemplateRule WHERE tr.templateId=? ORDER BY tr.orderNumber',
			[data.templateData.id],
			{props:result}
		)
		)
	.then(({result, state}) => ctx.replyWithMarkdown(
			( ( !result || !result.length ) ?
			"There are no rules yet for this template" :
			"The rules for this template are:\n\n"+result.map(rule => {
					const {orderNumber, propName, endsWith, defaultValue, title, description, author, type, siteName, imageDestination} = rule
					
					const propIdToName = (propId) => propId === null ? '' : state.props.filter(prop=>prop.id === propId)[0].propName
					
					const stdRules = [propName, endsWith, defaultValue]
					const urlRules = [title, imageDestination, siteName, description, type, author].map(propIdToName)
					
					return orderNumber+" - "+stdRules.join(', ')+( typeof rule.urlMetaTemplateRule !== 'number' ? '' : ("\\[ "+urlRules.join(', ')+" \]") )		//dunno y but first one wants \\
				}).join('\n')
			)+
			"\n\nTo change the rules reply to this message with the new set of rules that will replace the old ones (if any). Use the same format:\n\n"+
			"`number - property name, string end with, property default value`\n\n"+
			"Property names for pages are only Title and Content."+
			"You can leave blank between commas.\nIf the value contains a comma, wrap that in \" \".\n"+
			"Numbers must be progressive.\n\n"+
			"If it is a url that you want to parse add\n\n"+
			"`\[ title, image, site name, description, url, type, author \]`\n\n"+
			"after _`property default value`_ where values between \[\] are all properties names of the selected database where that information extracted from the url will be saved.\n"+
			"Property names are: "+state.props.map(prop=>prop.propName).join(', '),
			Markup.forceReply()
		)
		.then(({message_id}) => {
			cache.set(ctx.chat.id.toString(), {
				...data,
				replyFor:'editRule',
				props:state.props,
				message_id
			})
		})
	)
}

bot.action('editTextRules', ctx => ctx.answerCbQuery()
	.then(() => ctx.editMessageText("Editing text rules"))
	.then(() => setTextRules(ctx))
)

bot.action(/setImageDestination(\d+)/i, ctx=>
		ctx.answerCbQuery()
		.then(() => ctx.editMessageText(ctx.callbackQuery.message.text))
		.then(() => {
			const data = cache.get(ctx.chat.id.toString())
			
			if (!data)
				return ctx.reply("We lost your cached data, please start the operation again.\n\nSorry for the incovenience")
			
			return db.promiseExecute('UPDATE `Templates` SET `ImageDestination`=? WHERE id=?', [ctx.match[1], data.templateData.id], {data})
		})
		.then(({error, state}) => {
			if (!!error)
				throw new Error(error.code+" - "+error.sqlMessage)
			
			return ctx.reply("Done: now template "+state.data.templateData.userTemplateNumber+" is saving images to "+["content", "cover", "icon"][ctx.match[1]])
			.then(()=>state.data)
		})
		.then(data => {
			
			if(data.op==='edit')
				return selectTemplate(data.templateData.id, ctx)
			
			return setTextRules(ctx)
		})
		.catch(err => {
			console.warn(err)
			debugLog(ctx.message)
			ctx.reply("Error updating image destination: "+err+"\n\nYou can try again later, search the error or report the incident on GitHub.")
		})
	  )


const editImageDestination = ctx => ctx.reply(
	"In which section of the page do you want me to save images you send me?",
	Markup.inlineKeyboard([
		Markup.button.callback("Content", 'setImageDestination0'),
		Markup.button.callback("Cover",   'setImageDestination1'),
		Markup.button.callback("Icon",    'setImageDestination2')
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
	.then(() => db.promiseExecute('UPDATE `Templates` SET pageId=? WHERE id=?', [page.id, templateData.id]))
	.then(({error}) => {
		
		if(!!error)
			throw new Error(error.code+" - "+error.sqlMessage)
		
		cache.set(ctx.chat.id.toString(), {...userData, templateData, workspaceData, op, pageData:page})
		
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
		return ctx.reply("We lost your cached data, please start the operation again.\n\nSorry for the incovenience 😅")
	
	
	const {notionPages, pages, ...userData} = data
	
	const {id, icon, properties, object, title} = notionPages[parseInt(ctx.match[1])]
	
	const pageTitle = object === 'database' ? title[0].plain_text : notion.titleFromProps(properties)
	
	return db.promiseExecute(
		'INSERT INTO `NotionPages` (`pageType`, `workspaceId`, `notionPageId`, `icon`, `title`, `chatId`) VALUES (?, ?, ?, ?, ?, ?)',
		[object === "database" ? "db" : "pg", data.workspaceData.workspaceId, id, icon, pageTitle, data.templateData.chatId]
	)
	.then(({error}) => {
		
		if (!!error)
			throw new Error("Cannot register new page: "+error.code+" - "+error.sqlMessage)
		
		return db.promiseExecute('SELECT MAX(id) AS id, pageType, icon, title FROM NotionPages WHERE chatId=?', [data.templateData.chatId])
	})
	.then( ({result}) => {
		
		const props = Object.entries(properties).map( ([key, value]) => ([value.id, result[0].id, key, notion.propTypes.indexOf(value.type)]))
		props.push([null, result[0].id, "Content", null])
		
		//cannot use db.promise ( === db.execute) cuz cannot bulk import with prepared statements, using db.promiseQuery ( === db.query )
		return db.promiseQuery(
			   'INSERT INTO `NotionPagesProps` (`notionPropId`, `pageId`, `propName`, `propTypeId`) VALUES ?',
			   [props],
			   result
			)
	})
	.then(({error, state})=>{
		
		if (!!error)
			throw new Error("Cannot register props: "+error.code+" - "+error.sqlMessage)
			
		
		cache.set(ctx.chat.id.toString(), {...userData, pages:state})
		
		return selectPage(state[0].id, ctx)
	})
	.catch(err => {
		console.warn(err)
		ctx.reply("Error saving new page: "+err+"\n\nYou can try again later, search the error or report the incident on GitHub.")
	})
	
})

bot.on(['text', 'edited_message'], (ctx, next)=>{
	
	const data = cache.get(ctx.chat.id.toString())
	
	if (!!data &&
	    (
		( !!ctx.message && !!ctx.message.reply_to_message && ctx.message.reply_to_message.message_id === data.message_id ) || 
		( !!ctx.update && !!ctx.update.edited_message && !!ctx.update.edited_message.reply_to_message && ctx.update.edited_message.reply_to_message.message_id === data.ed_message_id ) 
	    ) 
	) {
		
		switch(data.replyFor){
			case 'editRule':
				try {
					/*exampe for https://t.me/ebookfreehouse: 
					0 - , ⁣📚*,
					1 - title, \n, 
					2 - , ⁣📚*\n\n✍🏻 Autore: , 
					3 - Auhor, \n🇮🇹 Lingua: Italiano\n📆 Anno: ,
					4 - Year, \n📖 Genere: ,
					5 - tags, \n📝 Fonte: Liber Liber (https://bit.ly/3AYD1eF) \n————————————————————\n\n🖊, 
					6 - type, , book
					7 - content, \n@EbookFreeHouse
					*/
					
					const text = !!ctx.message ? ctx.message.text : ctx.update.edited_message.text
					
					const rows = text.split(/\n?(\d+) *- *//* match like '5 - '*/).filter(item => item.length > 1) //remove order number from capture group (\d+), will use that in future to have different parse and write order
	// 				debugLog(rows)
					const rules = rows.map(rule => {
						const a = rule.split(/ *\[(.*)\] */)
						
						if (a[a.length-1] === '')
							a.pop()
						
						const [one, two] = a.map(item=>item.split(/ *, */).map(str => str.length ? str.trim() : null))
						if (!!two)
							one.push(two)
						
						
						//prepare data for import
						return one.map((item, key) => {
							
							const propNameToId = propName => {
								
								if (!propName)
									return null
								
								const prop = data.props.filter(prop => prop.propName.toLowerCase() === propName.toLowerCase())
								
								if (!prop.length)
									throw new Error("Couldnt find property `"+propName+"` in the selected page.")
								
								return prop[0].id
							}
							
							switch (key){
								case 0:
									//prop name to prop id
									return propNameToId(item)
								case 1:
								case 2:
									//TODO ATTENTION remove " and evaluate escaped characters
									return item
								case 3:
									//prop names to prop ids
								
									const urlRules = item.map(propNameToId)
									
									return Array(6).fill(null).map((el, key) => !!urlRules[key] ? urlRules[key] : null)
									
							}
						})
					})
					
					debugLog("Parsed rules: ", rules)
					
					const urlRules = rules.filter(rule=>rule.length === 4).map(rule=>rule[3])
					
					debugLog("Parsed url rules: ", urlRules)
					
					return db.transactionPromise()
					.then((connection, transactionError) => {
						
						if (!!transactionError)
							throw new Error("Cannot begin transaction: "+transactionError.code+" - "+transactionError.sqlMessage)
						
						return connection.promiseExecute(
							'DELETE FROM UrlMetaTemplateRules USING UrlMetaTemplateRules, TemplateRules WHERE TemplateRules.templateId=? AND TemplateRules.urlMetaTemplateRule=UrlMetaTemplateRules.id',
							[data.templateData.id]
						)
						.then(({error}) => {
							
							if (!!error)
								throw new Error("Cannot delete old url rules: "+error.code+" - "+error.sqlMessage)
							
							if (!urlRules || !urlRules.length)
								return 
							
							return connection.promiseQuery(
								'INSERT INTO `UrlMetaTemplateRules` (title, imageDestination, siteName, description, type, author) VALUES ?', 
								[urlRules]
							)
						})
						.then(({error}) => {
							if (!!error)
								throw new Error("Cannot save url rules: "+error.code+" - "+error.sqlMessage)
							
							return connection.promiseExecute('DELETE FROM TemplateRules WHERE templateId=?', [data.templateData.id])
						})
						.then(({error}) => {
							if (!!error)
								throw Error("Cannot delete old rules: "+error.code+" - "+error.sqlMessage)
							
							return connection.promiseExecute('SELECT MAX(id) AS id from `UrlMetaTemplateRules`', [])
						})
						.then(({result}) =>{
							
							const ruleHasUrlOptions = rules.map(rule => rule.length === 4 ? 1 : 0)
							
							const a = [rules.map((rule, key, rules) => [ data.templateData.id, key, ...rule.slice(0,3), rule.length === 4 ? ( result[0].id - urlRules.length + ruleHasUrlOptions.slice(0, key+1).reduce((a,b) => a+b, 0) ) : null ])]
							
							return connection.promiseQuery(
								'INSERT INTO `TemplateRules` (templateId, orderNumber, propId, endsWith, defaultValue, urlMetaTemplateRule) VALUES ?',
								a
							)
						})
						.then(({error}) => {
							
							if (!!error)
								throw new Error("Cannot save rules: "+error.code+" - "+error.sqlMessage)
							
							return  connection.commitPromise(connection)
						})
						.then((error) =>{
							
							if (!!error)
								throw new Error("Cannot commit rules: "+error.code+" - "+error.sqlMessage)
							
							const {replyFor, message_id, props, ed_message_id, ...databis} = data
							cache.set(ctx.chat.id.toString(), databis)
							
							return ctx.reply("All good, understood new rules and updated.")
						})
						.catch(error=>{
							console.warn(error)
							connection.rollbackPromise(connection)
							return ctx.reply("Failed setting rules: \n"+error+"\n\nYou can try again later, search the error or report the incident on GitHub.")
						})
					})
				}
				catch (err){
					debugLog(err)
					
					ctx.reply(err+"\nYou can try again or /cancel\n\nThis page properties are: "+data.props.map(p=>p.propName).join(', '), Markup.forceReply())
					.then(({message_id})=>cache.set(ctx.chat.id.toString(), {...data, message_id, ed_message_id: ctx.updateType === 'edited_message' ? data.ed_message_id : data.message_id}))	//only allow edit on users last message
				}
				
				break;
			default:
			case 'addPage' :
				return notion.client.search({
					auth:data.workspaceData.accessToken,
					query:ctx.message.text,
				}).then(res=>{
					
					if (!res.results.length)
						return ctx.reply('no results, search again or /cancel', Markup.forceReply())
						.then(({message_id})=>cache.set(ctx.chat.id.toString(), {...data, message_id, ed_message_id: ctx.updateType === 'edited_message' ? data.ed_message_id : data.message_id}))	//only allow edit on users last message
					else{
						
						const {replyFor, message_id, ed_message_id, ...databis} = data
						cache.set(ctx.chat.id.toString(), {...databis, notionPages:res.results})
						
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
				break;
		}
	}
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
	.then(({message_id})=>cache.set(ctx.chat.id.toString(), {...data, message_id, replyFor:'addPage'}))
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
	return db.promiseExecute('SELECT id, pageType, icon, title FROM NotionPages WHERE chatId=?', [userData.templateData.chatId])
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
	return db.promiseExecute('SELECT wc.accessToken, wc.workspaceId, nw.name, nw.icon FROM NotionWorkspacesCredentials AS wc LEFT OUTER JOIN NotionWorkspaces AS nw ON nw.id=wc.workspaceId WHERE wc.chatId=?', [templateData.chatId])
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
			"Do you want to edit what to do with image or text?",
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
	
	return db.promiseExecute('SELECT id FROM TelegramChats WHERE telegramChatId=?', [ctx.chat.id])
	.then(({result})=>db.promiseExecute('INSERT INTO Templates (`userTemplateNumber`, `chatId`) VALUES (?, ?)', [userTemplateNumber, result[0].id], {id:result[0].id}))
	.then(({state})=>db.promiseExecute('SELECT MAX(id) AS id, userTemplateNumber, chatId FROM Templates WHERE chatId=?', [state.id]))
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
// 	db.promiseExecute('SELECT t.id, t.userTemplateNumber, p.pageType, p.icon, tc.id AS chatId FROM Templates AS t LEFT OUTER JOIN NotionPages AS p ON p.id=t.pageId LEFT OUTER JOIN TelegramChats AS tc ON tc.id = p.chatId WHERE tc.telegramChatId=? ORDER BY t.userTemplateNumber',[ctx.chat.id])
	//WARNING tmp to not create a new template every time the operation will not  conclude
	db.promiseExecute('SELECT t.id, t.userTemplateNumber, t.pageId, tc.id AS chatId, t.pageId FROM Templates AS t LEFT OUTER JOIN TelegramChats AS tc ON tc.id = t.chatId WHERE tc.telegramChatId=? ORDER BY t.userTemplateNumber',[ctx.chat.id])
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