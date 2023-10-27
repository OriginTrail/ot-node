import LocalBlockchain from '../../test/bdd/steps/lib/local-blockchain.mjs';

const port = parseInt(process.argv[2], 10);
const localBlockchain = new LocalBlockchain();

await localBlockchain.initialize(port, console);
