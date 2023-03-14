import LocalBlockchain from '../../test/bdd/steps/lib/local-blockchain.mjs';

const localBlockchain = new LocalBlockchain();

await localBlockchain.initialize(console);
