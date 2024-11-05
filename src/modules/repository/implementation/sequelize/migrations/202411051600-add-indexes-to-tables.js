export async function up({ context: { queryInterface } }) {
    await queryInterface.addIndex('service_agreement', ['blockchainId'], {
        name: 'blockchainIdIndex',
    });

    await queryInterface.addIndex('service_agreement', ['tokenId'], {
        name: 'tokenIdIndex',
    });

    await queryInterface.addIndex('paranet_synced_asset', ['ual'], {
        name: 'ualIndex',
    });

    await queryInterface.addIndex('paranet', ['blockchainId'], {
        name: 'blockchainIdIndex',
    });

    await queryInterface.addIndex('missed_paranet_asset', ['paranetUal'], {
        name: 'paranetUalIndex',
    });

    await queryInterface.addIndex('event', ['operationId'], {
        name: 'operationIdIndex',
    });

    await queryInterface.addIndex('commands', ['status'], {
        name: 'statusIndex',
    });

    await queryInterface.addIndex('get', ['operationId'], {
        name: 'operationIdIndex',
    });

    await queryInterface.addIndex('publish', ['operationId'], {
        name: 'operationIdIndex',
    });

    await queryInterface.addIndex('update', ['operationId'], {
        name: 'operationIdIndex',
    });

    await queryInterface.addIndex('publish_paranet', ['operationId'], {
        name: 'operationIdIndex',
    });

    await queryInterface.addIndex('get_response', ['operationId'], {
        name: 'operationIdIndex',
    });

    await queryInterface.addIndex('publish_response', ['operationId'], {
        name: 'operationIdIndex',
    });

    await queryInterface.addIndex('update_response', ['operationId'], {
        name: 'operationIdIndex',
    });

    await queryInterface.addIndex('publish_paranet_response', ['operationId'], {
        name: 'operationIdIndex',
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeIndex('service_agreement', 'blockchainIdIndex');

    await queryInterface.removeIndex('service_agreement', 'tokenIdIndex');

    await queryInterface.removeIndex('paranet_synced_asset', 'ualIndex');

    await queryInterface.removeIndex('paranet', 'blockchainIdIndex');

    await queryInterface.removeIndex('missed_paranet_asset', 'paranetUalIndex');

    await queryInterface.removeIndex('event', 'operationIdIndex');

    await queryInterface.removeIndex('commands', 'statusIndex');

    await queryInterface.removeIndex('get', 'operationIdIndex');

    await queryInterface.removeIndex('publish', 'operationIdIndex');

    await queryInterface.removeIndex('update', 'operationIdIndex');

    await queryInterface.removeIndex('publish_paranet', 'operationIdIndex');

    await queryInterface.removeIndex('get_response', 'operationIdIndex');

    await queryInterface.removeIndex('publish_response', 'operationIdIndex');

    await queryInterface.removeIndex('update_response', 'operationIdIndex');

    await queryInterface.removeIndex('publish_paranet_response', 'operationIdIndex');
}
