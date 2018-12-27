/* eslint-disable no-undef */

require('dotenv').config();
const fs = require('fs');

const fileToRead = `${process.env.ARTIFACTS_DIR}/truffle-migrate.log`;

fs.readFile(fileToRead, (err, data) => {
    if (err) throw err;
    const hint = 'Hub contract address: 			'; // eslint-disable-line no-tabs
    if (data.indexOf(hint) >= 0) {
        const begining = data.toString().indexOf(hint) + hint.length;
        const end = begining + 42;
        const hubContractAddress = data.toString().substring(begining, end);
        const jsonData = JSON.parse(fs.readFileSync(`${process.env.TRAVIS_BUILD_DIR}/.origintrail_noderc.image`));
        jsonData.blockchain.hub_contract_address = hubContractAddress;
        fs.writeFileSync(`${process.env.TRAVIS_BUILD_DIR}/.origintrail_noderc.image`, JSON.stringify(jsonData));
    } else {
        console.log('Hub not found, something is wrong!');
        process.exit(-1);
    }
});

