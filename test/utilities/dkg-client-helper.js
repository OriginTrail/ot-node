const DKG = require('dkg.js');

class DkgClientHelper {
    constructor(config) {
        this.client = new DKG(config);
        this.clientConfig = config;
    }

    async info() {
        return this.client.node.info();
    }

    async publish(data, wallet, hubContract) {
        const options = {
            visibility: 'public',
            holdingTimeInYears: 1,
            tokenAmount: 10,
            maxNumberOfRetries: 5,
            blockchain: {
                name: 'ganache',
                publicKey: wallet.evmOperationalWalletPublicKey,
                privateKey: wallet.evmOperationalWalletPrivateKey,
                hubContract,
            },
        };
        return this.client.asset.create(data, options);
    }

    async update(data, keywords, ual) {
        return this.client._publishRequest({
            ual,
            data,
            keywords,
            method: 'update',
            visibility: 'public',
        });
    }

    async get(ids) {
        return this.client._getRequest({
            ids,
        });
    }

    async search(resultType, query) {
        return this.client._searchRequest({
            resultType,
            query,
        });
    }

    async query(query) {
        return this.client._queryRequest({
            query,
        });
    }

    async getResult(UAL) {
        const getOptions = {
            validate: true,
            commitOffset: 0,
            maxNumberOfRetries: 5,
        };
        return this.client.asset.get(UAL, getOptions).catch(() => {});
    }
}

module.exports = DkgClientHelper;
