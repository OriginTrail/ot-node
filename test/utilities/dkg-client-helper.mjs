import DKG from 'dkg.js';

class DkgClientHelper {
    constructor(config) {
        this.client = new DKG(config);
    }

    async info() {
        return this.client.node.info();
    }

    async publish(data, wallet) {
        const options = {
            visibility: 'public',
            triplesNumber: 3,
            chunksNumber: 3,
            epochsNum: 5,
            tokenAmount: 10,
            maxNumberOfRetries: 5,
            hashFunctionId: 0,
            blockchain: {
                name: 'ganache',
                publicKey: wallet.evmOperationalWalletPublicKey,
                privateKey: wallet.evmOperationalWalletPrivateKey,
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

export default DkgClientHelper;
