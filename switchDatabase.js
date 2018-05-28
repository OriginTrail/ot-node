const fs = require('fs');

// prepare .env.example for next run based on second database technology
fs.readFile('.env', 'utf8', (err, data) => {
    if (err) throw err;
    var result = data.replace(/GRAPH_DATABASE=arangodb/g, 'GRAPH_DATABASE=neo4j');

    fs.writeFile('.env', result, 'utf8', (err) => {
        if (err) throw err;
    });
});
