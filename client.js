var socket = require('socket.io-client')('http://18.185.39.223:3010');
socket.on('connect', function(){
console.log('connected');
});
socket.on('event', function(data){});
socket.on('disconnect', function(){});
