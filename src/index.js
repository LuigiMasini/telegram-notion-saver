import bot from './bot.js'
import db from './db.js'
import onBoardingServer from './onBoarding.js'
import debugLog from './debug.js'

function start(){
	
	debugLog("starting service")
	
	/*Start order:
	 * mysql client
	 * https server
	 * bot
	 */
	
	if (db){
		
		//dumb query to initialize connection to db
		//pointless to start everithing if then it crashes at the first query)
		db.promiseExecute('SELECT max(id) FROM `TelegramChats`').then(
		({error}) => {

			if (error)
				throw error

			debugLog('db connected')

			//launch server
			onBoardingServer.start(err=>{

				//check server
				if (err)
					throw new Error ("Https server cn't start: "+err)

				debugLog('https server started')

				//start bot
				bot.launch().then(()=>debugLog('telegram bot launched\n'))


			})
		})
	}
	else{
		throw new Error ("mysql database is "+typeof db)
	}
}

start()

function stop(sig){
	
	debugLog("\n\nStopping service"+(!!sig ? " due to "+sig : "")+"\nBye!")
	
	/*Stop order (opposite of start order)
	 * bot
	 * https server
	 * mysql client
	 */
	
	bot.stop(sig)
	
	onBoardingServer.stop().then(()=>{
		
		//callback argument
		db.end()
	})
	
}

// Enable graceful stop
process.once('SIGINT', () => stop('SIGINT'))
process.once('SIGTERM', () => stop('SIGTERM'))
