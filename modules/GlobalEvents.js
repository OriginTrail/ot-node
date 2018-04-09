var events = require('events');

var em = new events.EventEmitter();
module.exports.globalEmitter = em;
