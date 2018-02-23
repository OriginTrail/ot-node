// External modules
var leveldup = require('levelup')
var leveldown = require('leveldown')
var kad = require('kad')
const quasar = require('kad-quasar')
var utilities = require('./utilities')()
var config = utilities.getConfig()

// Response pool
var ping_responses = []
var waiting_for_responses = false

module.exports = function () {
  var kademlia = {

    sendRequest: function (requestType, requestObject) {
      node.quasarPublish(requestType, requestObject)
    },

    getPingResponses: function () {
      return ping_responses
    },

    clearPingResponses: function () {
      ping_responses = []
    },

    waitForResponse: function () {
      waiting_for_responses = true
    },

    stopWaitingForResponse: function () {
      waiting_for_responses = false
    },

    start: function (ip) {

      const seed = ['0000000000000000000000000000000000000001', {
        hostname: config.KADEMLIA_SEED_IP,
        port: config.KADEMLIA_SEED_PORT
      }]

      const node = kad({
        transport: new kad.HTTPTransport(),
        storage: require('levelup')(leveldown('kad-storage')),
        contact: {
          hostname: ip,
          port: config.KADEMLIA_PORT
        }
      })
      node.plugin(quasar)

      if (config.IS_KADEMLIA_BEACON == 'false') {
        node.join(seed, function () {
          if (node.router.size != 0) {
            console.log('Kademlia connected to seed')
          } else {
            console.log('Kademlia connection to seed failed')
          }
        })
      }

      node.listen(config.KADEMLIA_PORT, function () {
        console.log('Kademlia service listening...')
      })

      node.quasarSubscribe('ot-ping-request', (content) => {
        if (content.sender_ip == config.NODE_IP && content.sender_port == config.RPC_API_PORT) {
          return
        }

        node.quasarPublish('ot-ping-response', {
          request_id: content.request_id,
          sender_ip: config.NODE_IP,
          sender_port: config.RPC_API_PORT,
          message: 'ALOHA'
        })
      })

      node.quasarSubscribe('ot-ping-response', (content) => {
        if (content.sender_ip == config.NODE_IP && content.sender_port == config.RPC_API_PORT) {
          return
        }

        if (waiting_for_responses == true) {
          ping_responses.push(content)
        }
      })
    }
  }

  return kademlia
}
