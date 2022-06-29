const jsonld = require("jsonld");

class UALService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  deriveUAL(blockchain, contract, tokenId) {
    return `did:${blockchain.toLowerCase()}:${contract.toLowerCase()}/${tokenId}`;
  }

  resolveUAL(ual) {
    const segments = ual.split(':');
    if (segments.length < 3 || segments[2].split('/').length < 2) {
      throw new Error (`UAL doesn't have correct format: ${ual}`);
    }
    return {blockchain: segments[1], contract: segments[2].split('/')[0], tokenId: segments[2].split('/')[1]}
  }
}

module.exports = UALService;
