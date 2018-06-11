var node_js_version = process.version.substring(0, 2);


if(node_js_version == 'v9') {
    var spawn = require('child_process').spawn;
    var otNode = spawn(process.argv[0],  []);


//noinspection JSUnresolvedFunction
    otNode.stdout.setEncoding('utf8');
    otNode.stdout.on('data', function (data) {
        var str = data.toString()
        var lines = str.split(/(\r?\n)/g);
        console.log(lines.join(""));
    });

    otNode.on('close', function (code) {
        console.log('process exit code ' + code);
    });
} else {
    console.log('Make sure you have the 9.x version of Node.js installed. Some features will not work well on versions less or greater then 9.x');
}





