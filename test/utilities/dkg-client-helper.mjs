import DKG from 'dkg.js';
import { CONTENT_ASSET_HASH_FUNCTION_ID } from '../../src/constants/constants.js';

class DkgClientHelper {
    constructor(config) {
        this.client = new DKG(config);
    }

    async info() {
        return this.client.node.info();
    }

    async publish(data) {
        const options = {
            visibility: 'public',
            epochsNum: 5,
            hashFunctionId: CONTENT_ASSET_HASH_FUNCTION_ID,
        };

        return this.client.asset.create(data, options);
    }

    async update(ual, assertion) {
        const options = {
            hashFunctionId: CONTENT_ASSET_HASH_FUNCTION_ID,
        };

        return this.client.asset.update(ual, assertion, options);
    }

    async get(ual, state) {
        const options = {
            state,
            validate: true,
        };

        return this.client.asset.get(ual, options);
    }

    async query(query) {
        return this.client.query(query);
    }
}

export default DkgClientHelper;
