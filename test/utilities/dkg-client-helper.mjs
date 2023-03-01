import DKG from 'dkg.js';
import { CONTENT_ASSET_HASH_FUNCTION_ID } from '../../src/constants/constants.js';

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
            epochsNum: 5,
            maxNumberOfRetries: 5,
            hashFunctionId: CONTENT_ASSET_HASH_FUNCTION_ID,
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
