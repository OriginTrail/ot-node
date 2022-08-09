const DKG = require('dkg.js');

class DkgClientHelper {
    constructor(config) {
        this.client = new DKG(config);
    }

    async info() {
        return this.client.nodeInfo();
    }

    async provision(data, keywords) {
        return this.client._publishRequest({
            content: data,
            keywords,
            method: 'provision',
            visibility: 'public',
        });
    }

    async publish(data, wallet) {
        const options = {
            visibility: 'public',
            holdingTimeInYears: 1,
            tokenAmount: 10,
            wallet,
            maxNumberOfRetries: 5,
            // what should i send trough
            // blockchain: 'ganache',
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

    async getResult(operation_id, operation) {
        return this.client
            ._getResult({
                operation_id,
                operation,
            })
            .catch(() => {
            });
    }
}

module.exports = DkgClientHelper;
