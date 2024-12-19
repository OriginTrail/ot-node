export async function up({ context: { queryInterface } }) {
    const indexes = [
        { table: 'shard', column: ['blockchain_id'], name: 'shard_blockchain_id_index' },
        { table: 'shard', column: ['last_dialed'], name: 'last_dialed_index' },
        {
            table: 'service_agreement',
            column: ['blockchain_id'],
            name: 'service_agreement_blockchain_id_index',
        },
        {
            table: 'service_agreement',
            column: ['blockchain_id', 'token_id'],
            name: 'blockchain_id_token_id_index',
        },
        { table: 'service_agreement', column: ['token_id'], name: 'token_id_index' },
        { table: 'paranet_synced_asset', column: ['ual'], name: 'paranet_synced_asset_ual_index' },
        {
            table: 'paranet_synced_asset',
            column: ['paranet_ual', 'data_source'],
            name: 'paranet_ual_data_source_index',
        },
        {
            table: 'paranet',
            column: ['blockchain_id', 'paranet_id'],
            name: 'blockchain_id_paranet_id_index',
        },
        { table: 'missed_paranet_asset', column: ['paranet_ual'], name: 'paranet_ual_index' },
        { table: 'missed_paranet_asset', column: ['ual'], name: 'missed_paranet_asset_ual_index' },
        { table: 'event', column: ['name', 'timestamp'], name: 'name_timestamp_index' },
        { table: 'event', column: ['operation_id'], name: 'event_operation_id_index' },
        { table: 'commands', column: ['name', 'status'], name: 'name_status_index' },
        { table: 'commands', column: ['status', 'started_at'], name: 'status_started_at_index' },
        { table: 'get', column: ['operation_id'], name: 'get_operation_id_index' },
        { table: 'publish', column: ['operation_id'], name: 'publish_operation_id_index' },
        { table: 'update', column: ['operation_id'], name: 'update_operation_id_index' },
        {
            table: 'publish_paranet',
            column: ['operation_id'],
            name: 'publish_paranet_operation_id_index',
        },
        { table: 'get', column: ['created_at'], name: 'get_created_at_index' },
        { table: 'publish', column: ['created_at'], name: 'publish_created_at_index' },
        { table: 'update', column: ['created_at'], name: 'update_created_at_index' },
        {
            table: 'publish_paranet',
            column: ['created_at'],
            name: 'publish_paranet_created_at_index',
        },
        {
            table: 'get_response',
            column: ['operation_id'],
            name: 'get_response_operation_id_index',
        },
        { table: 'publish_response', column: ['operation_id'], name: 'operation_id_index' },
        {
            table: 'update_response',
            column: ['operation_id'],
            name: 'update_response_operation_id_index',
        },
        {
            table: 'publish_paranet_response',
            column: ['operation_id'],
            name: 'publish_paranet_response_operation_id_index',
        },
        { table: 'get_response', column: ['created_at'], name: 'get_response_created_at_index' },
        {
            table: 'publish_response',
            column: ['created_at'],
            name: 'publish_response_created_at_index',
        },
        {
            table: 'update_response',
            column: ['created_at'],
            name: 'update_response_created_at_index',
        },
        {
            table: 'publish_paranet_response',
            column: ['created_at'],
            name: 'publish_paranet_response_created_at_index',
        },
        { table: 'blockchain', column: ['contract'], name: 'contract_index' },
    ];

    for (const index of indexes) {
        const { table, column, name } = index;

        // eslint-disable-next-line no-await-in-loop
        const [results] = await queryInterface.sequelize.query(`
            SELECT COUNT(1) AS count 
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND INDEX_NAME = '${name}';
        `);

        if (results[0].count === 0) {
            // eslint-disable-next-line no-await-in-loop
            await queryInterface.addIndex(table, column, { name });
        }
    }
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeIndex('shard', 'shard_blockchain_id_index');

    await queryInterface.removeIndex('shard', 'last_dialed_index');

    await queryInterface.removeIndex('service_agreement', 'service_agreement_blockchain_id_index');

    await queryInterface.removeIndex('service_agreement', 'blockchain_id_token_id_index');

    await queryInterface.removeIndex('service_agreement', 'token_id_index');

    await queryInterface.removeIndex('paranet_synced_asset', 'paranet_synced_asset_ual_index');

    await queryInterface.removeIndex('paranet_synced_asset', 'paranet_ual_data_source_index');

    await queryInterface.removeIndex('paranet', 'blockchain_id_paranet_id_index');

    await queryInterface.removeIndex('missed_paranet_asset', 'paranet_ual_index');

    await queryInterface.removeIndex('missed_paranet_asset', 'missed_paranet_asset_ual_index');

    await queryInterface.removeIndex('event', 'name_timestamp_index');

    await queryInterface.removeIndex('event', 'event_operation_id_index');

    await queryInterface.removeIndex('commands', 'name_status_index');

    await queryInterface.removeIndex('commands', 'status_started_at_index');

    await queryInterface.removeIndex('get', 'get_operation_id_index');

    await queryInterface.removeIndex('publish', 'publish_operation_id_index');

    await queryInterface.removeIndex('update', 'update_operation_id_index');

    await queryInterface.removeIndex('publish_paranet', 'publish_paranet_operation_id_index');

    await queryInterface.removeIndex('get', 'get_created_at_index');

    await queryInterface.removeIndex('publish', 'publish_created_at_index');

    await queryInterface.removeIndex('update', 'update_created_at_index');

    await queryInterface.removeIndex('publish_paranet', 'publish_paranet_created_at_index');

    await queryInterface.removeIndex('get_response', 'get_response_operation_id_index');

    await queryInterface.removeIndex('publish_response', 'publish_response_operation_id_index');

    await queryInterface.removeIndex('update_response', 'update_response_operation_id_index');

    await queryInterface.removeIndex(
        'publish_paranet_response',
        'publish_paranet_response_operation_id_index',
    );

    await queryInterface.removeIndex('get_response', 'get_response_created_at_index');

    await queryInterface.removeIndex('publish_response', 'publish_response_created_at_index');

    await queryInterface.removeIndex('update_response', 'update_response_created_at_index');

    await queryInterface.removeIndex(
        'publish_paranet_response',
        'publish_paranet_response_created_at_index',
    );

    await queryInterface.removeIndex('blockchain', 'contract_index');
}
