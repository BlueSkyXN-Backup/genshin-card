const NodeCache = require( "node-cache" )

const cache = (duration) => {
  const myCache = new NodeCache( { stdTTL: duration } )
  return (req, res, next) => {
    let key = '__cache__' + req.originalUrl || req.url
    let cachedBody = myCache.get(key)
    if (cachedBody) {
      res.send(cachedBody)
      return
    } else {
      res.sendResponse = res.send
      res.send = (body) => {
        myCache.set(key, body)
        res.sendResponse(body)
      }
      next()
    }
  }
}

module.exports = cache