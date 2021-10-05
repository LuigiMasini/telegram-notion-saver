function debugLog (...args) {
	if (process.env.DEBUG)
		console.log(...args)
}

export default debugLog