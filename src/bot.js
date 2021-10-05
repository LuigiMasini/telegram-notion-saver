import { Telegraf, Markup } from 'telegraf'


import db from './db.js'
import onBoardingServer from './onBoarding.js'
import debugLog from './debug.js'


const bot = new Telegraf(process.env.telegramBotToken)



function authorizeInNotion (ctx, again=false){
	
	const notionAuthorizationUrl = new URL ("https://api.notion.com/v1/oauth/authorize")
	
	notionAuthorizationUrl.searchParams.append("client_id", process.env.notionOAuthClientId)
	notionAuthorizationUrl.searchParams.append("redirect_uri", onBoardingServer.redirect_uri)
	notionAuthorizationUrl.searchParams.append("response_type", "code")
	notionAuthorizationUrl.searchParams.append("state", '"'+ctx.chat.id+'"')
	notionAuthorizationUrl.searchParams.append("owner", "user")
	
	ctx.reply( (again ? "A" : "Fisrt thing, a")+"uthorize the integration in Notion and select which pages to make available to this bot",
		Markup.inlineKeyboard([
			Markup.button.url("Authorize in Notion", notionAuthorizationUrl),
		])
	)
}

bot.action('stopReauthorization', ctx=>
		ctx.answerCbQuery()
		.then(()=>ctx.editMessageText("You are alredy registered, do you wish to autorize again?"))	//remove keyboard
		.then(()=>ctx.reply('nevermind'))
	  )

bot.action('continueReauthorization', ctx=>
		ctx.answerCbQuery()
		.then(()=>ctx.editMessageText("You are alredy registered, do you wish to autorize again?"))	//remove keyboard
		.then(()=>authorizeInNotion(ctx, true))
	  )

bot.start(ctx=>{
	
	debugLog(ctx.chat)
	
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


export default bot
export {Markup}