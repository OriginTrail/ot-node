// External modules
var fs = require('fs')
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'))
var ipaddr = require('ipaddr.js')
var sha3 = require('solidity-sha3').default

module.exports = function () {
  var utilities = {

    executeCallback: function executeCallback (callback, callback_input) {
      if (typeof callback === 'function') {
        callback(callback_input)
      } else {
        console.log('Callback not defined!')
      }
    },

    getConfig: function () {
      return config
    },

    isEmptyObject: function (test_object) {
      return Object.keys(test_object).length === 0 && test_object.constructor === Object
    },

    getRandomInt: function (max) {
      return Math.floor(Math.random() * Math.floor(max))
    },

    sha3: function (value) {
      return sha3(value)
    },

    isIpEqual: function (ip1, ip2) {
      var ip1v4 = ipaddr.process(ip1).octets.join('.')
      var ip2v4 = ipaddr.process(ip2).octets.join('.')
      return ip1v4 == ip2v4
    },

    copyObject: function (Obj) {
      return JSON.parse(JSON.stringify(Obj))
    },

    sortObject: function (object) {
      var sortedObj = {},
        keys = Object.keys(object)

      keys.sort(function (key1, key2) {
        key1 = key1.toLowerCase(), key2 = key2.toLowerCase()
        if (key1 < key2) return -1
        if (key1 > key2) return 1
        return 0
      })

      for (var index in keys) {
        var key = keys[index]
        if (typeof object[key] === 'object' && !(object[key] instanceof Array)) {
          sortedObj[key] = this.sortObject(object[key])
        } else {
          sortedObj[key] = object[key]
        }
      }

      return sortedObj
    }
  }

  return utilities
}
