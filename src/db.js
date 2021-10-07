import mysql from 'mysql2'

import debugLog from './debug.js'

const db = mysql.createPool({
	host: process.env.dbHost,
	user: process.env.dbUser,
	password: process.env.dbPassword,
	database: process.env.dbName,
	port:process.env.dbPort,
	namedPlaceholders:true,
})

function handleError(error, reject, state){
	!!error && error.code != 'ER_DUP_ENTRY' && debugLog(error)
	
	if (error && error.fatal)
		reject(error, state)
}

const promisify = (object=db, method="execute") => (query, params, state) => new Promise((resolve, reject) =>
	object[method](query, params, (error, result, fields)=>{
		handleError(error, reject, state)
		resolve({error, result, fields, state})
	})
)

const commitPromise = (connection)=>new Promise((resolve, reject)=>
	connection.commit(error=>{
		handleError(error, reject)
		
		connection.release()
		
		resolve(error)
	})
)

const transactionPromise = ()=>new Promise((resolve, reject)=>

	db.getConnection((error, connection)=>{
		connection.beginTransaction(error=>{
			handleError(error, reject)
			resolve(Object.assign(connection, {promise:promisify(connection, "execute"), commitPromise}), error)
		})
	})
)

export default Object.assign(db, {promise:promisify(db, "execute"), promiseQuery:promisify(db, "query"), transactionPromise})