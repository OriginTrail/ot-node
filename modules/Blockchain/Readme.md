Blockchain implementations
========================

#### Instruction manual for enabling new blockchain integrations

OT-Node operates as a multi-chain node in the network and can communicate with different 
blockchain simultaneously. Currently, it supports Ethereum, xDai, Polygon, while OriginTrail Parachain is in experimental phase.
In order to integrate new blockchain implementation, the following modifications have to be performed.

## Directory structure

Create directory for new blockchain using the following command:
```bash
mkdir modules/Blockchain/<blockchain_name>
```
If the existing web3 implementation is compatible with the new blockchain, copy content of Ethereum directory to the new directory.
The new directory should contain the following content:
- /abi - Smart contracts ABI files
- /build - Smart contracts build directory
- /constracts - Smart contracts implementation
- /migrations - Smart contracts truffle migrations
- /test - Truffle tests for smart contracts
- index.js - Blockchain implementation
- truffle.js - Truffle configuration file

## Smart contracts deployment

After smart contractsand truffle configuration updates, deploy smart contracts using the following command:

```nashorn js
cd modules/Blockchain/Polygon && truffle migrate --network testnet -f 2
```

## Blockchain implementation

Blockchain implementation is located in ```index.js``` file and presents a class that contains 
methods for blockchain communication. If the class is compatible with web3 implementation, the class should extend it:

```js
class <blockchain_name> extends Web3Implementation { ... }
```

Blockchain-specific methods, like gas pricing, should be extended and implemented. After the blockchain implementation is finished, it should be integrated and supported by the OT-Node. 
The following files should be updated with the new implementation:

```modules/constants.js```
```js
exports.BLOCKCHAIN_TITLE = {
    OriginTrailParachain: 'OriginTrail-Parachain',
    Ethereum: 'Ethereum',
    XDai: 'xDai',
    Polygon: 'Polygon',
};
```

```modules/Blockchain.js```
```js
for (let i = 0; i < this.config.implementations.length; i += 1) {
    const implementation_configuration = this.config.implementations[i];

    switch (implementation_configuration.blockchain_title) {
    case constants.BLOCKCHAIN_TITLE.Ethereum:
        this.blockchain[i] = new Ethereum(ctx, implementation_configuration);
        break;
    case constants.BLOCKCHAIN_TITLE.XDai:
        this.blockchain[i] = new XDai(ctx, implementation_configuration);
        break;
    case constants.BLOCKCHAIN_TITLE.Polygon:
        this.blockchain[i] = new Polygon(ctx, implementation_configuration);
        break;
    case constants.BLOCKCHAIN_TITLE.OriginTrailParachain:
        this.blockchain[i] = new OriginTrailParachain(ctx, implementation_configuration);
        break;
    default:
        this.log.error('Unsupported blockchain', implementation_configuration.blockchain_title);
    }
}
```
## Configuration

In order to enable new blockchain implementation, the configuration should be updated for all environments ```(development, testnet, mainnet)```.
The following snippet presents an example of configuration that should be added to blockchain implementations array:

```json
{
  "blockchain_title": "",
  "network_id": "<blockchain_name>:mainnet|testnet",
  "rpc_server_url": "",
  "chain_id": ,
  "hub_contract_address": "",
  "identity_filepath": "<blockchain_name>_erc725_identity.json",
  "gas_limit": "2000000",
  "gas_price": "1000000000",
  "dc_price_factor" : "3",
  "dh_price_factor" : "2",
  "trac_price_in_base_currency" : "0.4"
}
```


Contribution
============

OriginTrail is an open source project. We happily invite you to join us in our mission of building decentralised world of supply chain. If you would like to contribute, you are more than welcome.


### Useful links


[OriginTrail website](https://origintrail.io)

[OriginTrail documentation page](http://docs.origintrail.io)

[OriginTrail Discord Group](https://discordapp.com/invite/FCgYk2S)

[OriginTrail Telegram Group](https://t.me/origintrail)

[OriginTrail Twitter](https://twitter.com/origin_trail)

