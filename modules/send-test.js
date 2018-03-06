const testTable = require('./test_table');
//let counter = 0;

setInterval(() => {
    console.log(testTable().nextTest(function(res, err){
        console.log(res)
    }));
	//process.send();
}, 1000);
