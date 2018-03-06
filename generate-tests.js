const testing = require('./modules/testing');
var graph = require('./modules/graph')();
//function(dh_ip, dh_port, dh_wallet, encrypted_vertices, number_of_tests, start_time, end_time, callback)


let vertices = [{identifiers: {a:1}, data: [1,2,3,4,5]},{identifiers: {a:2}, data:{a:'a',b:'b',c:'c'}},{identifiers: {a:3}, data:{a:['a','abc','def']}}];
//console.log(vertices);
let encryptedVertices = graph.encryptVertices(vertices);
let hour = 1520354748 + (60 * 60);
//console.log(encryptedVertices.vertices);
testing().generateTests('192.168.0.10', '8999', '0xE1E9c5379C5df627a8De3a951fA493028394A050', encryptedVertices.vertices, 10, 1520354748, hour, (res, err) => {
  //console.log(res);
});