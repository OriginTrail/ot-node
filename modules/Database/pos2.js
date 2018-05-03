const neo4j = require('neo4j-driver').v1;
const databaseData = require('../../test/modules/test_data/database-data.js');
const neo = require('./Neo4j.js');
const stringify = require('json-stable-stringify');

const user = 'neo4j';
const password = 'otpass';

const host = 'localhost';
const port = '7687';




let testdb;

const vertexOne = databaseData.vertices[0];

testdb = new neo(user,password,'DbName',host,port);

duo =  { _key: '2e0b1ba163be76138d51a0b8258e97d7' };

testdb.findTraversalPath(duo, 1).then((res) => {
    console.log(res);
}).catch((err) => {
    console.log(err);
});



