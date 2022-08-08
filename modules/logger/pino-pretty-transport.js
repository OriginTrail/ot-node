// pino-pretty-transport.js
// eslint-disable-next-line global-require
module.exports = opts => require('pino-pretty')({
    ...opts,
    translateTime: 'yyyy-mm-dd HH:MM:ss',
    ignore: 'pid,hostname,Event_name,Operation_name,Id_operation',
    hideObject: true,
    messageFormat: (log, messageKey) => `${log[messageKey]}`
})
