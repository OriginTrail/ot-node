var node_js_version = process.version.substring(0, 2);


if (node_js_version !== 'v8') {
    console.log('Make sure you have the 9.x version of Node.js installed. Some features will not work well on versions less or greater then 9.x');
    process.exit(222);
}

