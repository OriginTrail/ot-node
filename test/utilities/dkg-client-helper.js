const DkgClient = require('dkg-client');

class DkgClientHelper {
    constructor(config) {
        this.client = new DkgClient(config);
    }

    async info() {
        return this.client.nodeInfo();
    }

    async provision(data, keywords) {
        return this.client._publishRequest({
            data,
            keywords,
            method: 'provision',
            visibility: 'public',
        });
    }

    async publish(data, keywords) {
        return this.client._publishRequest({
            data,
            keywords,
            method: 'publish',
            visibility: 'public',
        });
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

    async resolve(ids) {
        return this.client
            ._resolveRequest({
                ids,
            });
    }

    async search(resultType, query) {
        return this.client
            ._searchRequest({
                resultType,
                query,
            });
    }

    async query(query) {
        return this.client
            ._queryRequest({
                query,
            });
    }

    async getResult(handler_id, operation) {
        return this.client
            ._getResult({
                handler_id,
                operation,
            }).catch((error) => {
                console.log(`error getting result. ${error}`);
            });
    }
}

module.exports = DkgClientHelper;
