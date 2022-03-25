const DkgClient = require('dkg-client');

class DkgClientHelper {
    constructor(config) {
        this.client = new DkgClient({
            endpoint: config.host,
            port: config.port,
            useSSL: config.useSSL,
        });
    }

    async info() {
        return this.client.nodeInfo();
    }
    //
    // async provision (data, keywords) {
    //     return this.client._publishRequest({
    //         data,
    //         keywords,
    //         method: 'provision',
    //         visibility: 'public',
    //     }).catch((error) => {
    //         console.log(`error provisioning dataset. ${error}`);
    //     });
    // }
    //
    // async publish () {
    //     return this.client.nodeInfo();
    // }
    //
    // async publish () {
    //     return this.client.nodeInfo();
    // }
    //
    // async publish () {
    //     return this.client.nodeInfo();
    // }
    //
    // async publish () {
    //     return this.client.nodeInfo();
    // }
    //
    // async publish () {
    //     return this.client.nodeInfo();
    // }
    //
    // async publish () {
    //     return this.client.nodeInfo();
    // }
    //
    // async publish () {
    //     return this.client.nodeInfo();
    // }
}
module.exports = DkgClientHelper;
//
// const client = );
//
// exports.info = async () => client.nodeInfo();
//
// exports.publish = async (data, keywords) => client
//     ._publishRequest({
//         data,
//         keywords,
//         method: 'publish',
//         visibility: 'public',
//     })
//     .catch((error) => {
//         console.log(`error publishing dataset. ${error}`);
//     });
//
// exports.update = async (data, keywords, ual) => client.assets
//     .update(ual, {
//         data,
//         keywords,
//         method: 'update',
//         visibility: 'public',
//     })
//     .catch((error) => {
//         console.log(`error updating dataset. ${error}`);
//     });
//
// exports.resolve = async (ids) => client
//     ._resolveRequest({
//         ids,
//     })
//     .catch((error) => {
//         console.log(`error resolving. ${error}`);
//     });
//
// exports.search = async (resultType, query) => client
//     ._searchRequest({
//         resultType,
//         query,
//     })
//     .catch((error) => {
//         console.log(`error searching. ${error}`);
//     });
//
// exports.getSearchResult = async (resultType, handler_id) => client
//     ._getSearchResult({
//         resultType,
//         handler_id,
//     })
//     .catch((error) => {
//         console.log(`error getting search result. ${error}`);
//     });
//
// exports.query = async (query) => client
//     ._queryRequest({
//         query,
//     })
//     .catch((error) => {
//         console.log(`error querying. ${error}`);
//     });
//
// exports.getResult = async (operation, handler_id) => client
//     ._getResult({
//         handler_id,
//         operation,
//     })
//     .catch((error) => {
//         console.log(`error getting result. ${error}`);
//     });
