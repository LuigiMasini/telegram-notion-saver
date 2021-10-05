import mysql from 'mysql2'

const db = mysql.createConnection({
	host: process.env.dbHost,
	user: process.env.dbUser,
	password: process.env.dbPassword,
	database: process.env.dbName,
	port:process.env.dbPort,
})


const promise = (query, params)=>new Promise((resolve, reject)=>
	db.execute(query, params, (error, result, fields)=>{
		if (error && error.fatal)
			reject(error)
		resolve(error, result, fields)
	})
)

export default Object.assign(db, {promise})