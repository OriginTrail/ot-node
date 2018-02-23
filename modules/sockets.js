// External modules
var product = require('./product')()
var blockchain = require('./blockchain')()
var importer = require('./importer')()
var utilities = require('./utilities')()
var io = require('socket.io')()

// Socket communication settings
// io.set('origins', 'localhost:*');

io.on('connection', function (socket) {
  console.log('RPC Server connected')

  socket.on('event', function (data) {
    if (data.request == 'trail-request') {
      var queryObject = data.queryObject
      var clientRequest = data.clientRequest

      product.getTrailByQuery(queryObject, function (trail_graph) {
        socket.emit('event', {
          response: 'trail-response',
          responseData: trail_graph,
          clientRequest: clientRequest
        })
      })
    } else if (data.request == 'import-request') {
      var queryObject = data.queryObject
      var clientRequest = data.clientRequest

      var input_file = queryObject.filepath

      importer.importXML(input_file, function (data) {
        socket.emit('event', {
          response: 'import-response',
          responseData: data,
          clientRequest: clientRequest
        })
      })
    } else if (data.request == 'blockchain-request') {
      var queryObject = data.queryObject
      var owner = queryObject.owner
      var batch_uid_hash = utilities.sha3(queryObject.batch_uid)
      var clientRequest = data.clientRequest

      var input_file = queryObject.filepath

      blockchain.getFingerprint(owner, batch_uid_hash, function (data) {
        socket.emit('event', {
          response: 'blockchain-response',
          responseData: data,
          clientRequest: clientRequest
        })
      })
    } else if (data.request == 'expiration-request') {
      var queryObject = data.queryObject
      var clientRequest = data.clientRequest

      product.getExpirationDates(queryObject, function (data) {
        socket.emit('event', {
          response: 'expiration-response',
          responseData: data,
          clientRequest: clientRequest
        })
      })
    } else {
      socket.emit('event', {
        response: 'Unsupported request'
      })
    }
  })
})

module.exports = function () {
  var sockets = {

    start: function () {
      io.listen(3000)
      console.log('IPC-RPC Communication server listening on port ' + 3000)
    }

  }

  return sockets
}
