import LocalBlockchain from '../../test/bdd/steps/lib/local-blockchain.mjs';

const port = parseInt(process.argv[2], 10);
const version = process.argv.length > 3 ? process.argv[3] : '';
const localBlockchain = new LocalBlockchain();

await localBlockchain.initialize(port, console, version);
