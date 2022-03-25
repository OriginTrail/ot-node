const DkgClient = require('dkg-client');
const HOST = ['0.0.0.0'];
const OT_NODE_PORT = 8900;

const client = new DkgClient({
    endpoint: HOST,
    port: OT_NODE_PORT,
    useSSL: false,
});

exports.provision = async (data, keywords) => client
    ._publishRequest({
        data,
        keywords,
        method: 'provision',
        visibility: 'public',
    }).catch((error) => {
        console.log(`error provisioning dataset. ${error}`);
    });

exports.publish = async (data, keywords) => client
    ._publishRequest({
        data,
        keywords,
        method: 'publish',
        visibility: 'public',
    })
    .catch((error) => {
        console.log(`error publishing dataset. ${error}`);
    });

exports.update = async (data, keywords, ual) => client.assets
    .update(ual, {
        data,
        keywords,
        method: 'update',
        visibility: 'public',
    })
    .catch((error) => {
        console.log(`error updating dataset. ${error}`);
    });

exports.resolve = async (ids) => client
    ._resolveRequest({
        ids,
    })
    .catch((error) => {
        console.log(`error resolving. ${error}`);
    });

exports.search = async (resultType, query) => client
    ._searchRequest({
        resultType,
        query,
    })
    .catch((error) => {
        console.log(`error searching. ${error}`);
    });

exports.getSearchResult = async (resultType, handler_id) => client
    ._getSearchResult({
        resultType,
        handler_id,
    })
    .catch((error) => {
        console.log(`error getting search result. ${error}`);
    });

exports.query = async (query) => client
    ._queryRequest({
        query,
    })
    .catch((error) => {
        console.log(`error querying. ${error}`);
    });

exports.getResult = async (operation, handler_id) => client
    ._getResult({
        handler_id,
        operation,
    })
    .catch((error) => {
        console.log(`error getting result. ${error}`);
    });
