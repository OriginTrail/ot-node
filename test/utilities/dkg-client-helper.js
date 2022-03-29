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
        }).catch((error) => {
            console.log(`error provisioning dataset. ${error}`);
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
        }).catch((error) => {
            console.log(`error publishing dataset. ${error}`);
        });
    }

    async resolve(ids) {
        return this.client
            ._resolveRequest({
                ids,
            }).catch((error) => {
                console.log(`error resolving. ${error}`);
            });
    }

    async search(resultType, query) {
        return this.client
            ._searchRequest({
                resultType,
                query,
            }).catch((error) => {
                console.log(`error searching. ${error}`);
            });
    }

    async getSearchResult(resultType, handler_id) {
        return this.client
            ._getSearchResult({
                resultType,
                handler_id,
            })
            .catch((error) => {
                console.log(`error getting search result. ${error}`);
            });
    }

    async query(query) {
        return this.client
            ._queryRequest({
                query,
            }).catch((error) => {
                console.log(`error querying. ${error}`);
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
