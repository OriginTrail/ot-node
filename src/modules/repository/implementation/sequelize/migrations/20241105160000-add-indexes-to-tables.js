export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addIndex('shard', ['blockchain_id'], {
        name: 'blockchain_id_index',
    });

    await queryInterface.addIndex('shard', ['last_dialed'], {
        name: 'last_dialed_index',
    });

    await queryInterface.addIndex('service_agreement', ['blockchain_id'], {
        name: 'blockchain_id_index',
    });

    await queryInterface.addIndex('service_agreement', ['blockchain_id', 'token_id'], {
        name: 'blockchain_id_token_id_index',
    });

    await queryInterface.addIndex('service_agreement', ['token_id'], {
        name: 'token_id_index',
    });

    await queryInterface.addIndex('paranet_synced_asset', ['ual'], {
        name: 'ual_index',
    });

    await queryInterface.changeColumn('paranet_synced_asset', 'data_source', {
        type: Sequelize.ENUM('sync', 'local_store'),
        allowNull: true,
    });

    await queryInterface.addIndex('paranet_synced_asset', ['paranet_ual', 'data_source'], {
        name: 'paranet_ual_data_source_index',
    });

    await queryInterface.addIndex('paranet', ['blockchain_id', 'paranet_id'], {
        name: 'blockchain_id_paranet_id_index',
    });

    await queryInterface.addIndex('missed_paranet_asset', ['paranet_ual'], {
        name: 'paranet_ual_index',
    });

    await queryInterface.addIndex('missed_paranet_asset', ['ual'], {
        name: 'ual_index',
    });

    await queryInterface.addIndex('event', ['name', 'timestamp'], {
        name: 'name_timestamp_index',
    });

    await queryInterface.addIndex('event', ['operation_id'], {
        name: 'operation_id_index',
    });

    await queryInterface.addIndex('commands', ['name', 'status'], {
        name: 'name_status_index',
    });

    await queryInterface.addIndex('commands', ['status', 'started_at'], {
        name: 'status_started_at_index',
    });

    await queryInterface.addIndex('get', ['operation_id'], {
        name: 'operation_id_index',
    });

    await queryInterface.addIndex('publish', ['operation_id'], {
        name: 'operation_id_index',
    });

    await queryInterface.addIndex('update', ['operation_id'], {
        name: 'operation_id_index',
    });

    await queryInterface.addIndex('publish_paranet', ['operation_id'], {
        name: 'operation_id_index',
    });

    await queryInterface.addIndex('get', ['created_at'], {
        name: 'created_at_index',
    });

    await queryInterface.addIndex('publish', ['created_at'], {
        name: 'created_at_index',
    });

    await queryInterface.addIndex('update', ['created_at'], {
        name: 'created_at_index',
    });

    await queryInterface.addIndex('publish_paranet', ['created_at'], {
        name: 'created_at_index',
    });

    await queryInterface.addIndex('get_response', ['operation_id'], {
        name: 'operation_id_index',
    });

    await queryInterface.addIndex('publish_response', ['operation_id'], {
        name: 'operation_id_index',
    });

    await queryInterface.addIndex('update_response', ['operation_id'], {
        name: 'operation_id_index',
    });

    await queryInterface.addIndex('publish_paranet_response', ['operation_id'], {
        name: 'operation_id_index',
    });

    await queryInterface.addIndex('get_response', ['created_at'], {
        name: 'created_at_index',
    });

    await queryInterface.addIndex('publish_response', ['created_at'], {
        name: 'created_at_index',
    });

    await queryInterface.addIndex('update_response', ['created_at'], {
        name: 'created_at_index',
    });

    await queryInterface.addIndex('publish_paranet_response', ['created_at'], {
        name: 'created_at_index',
    });

    await queryInterface.addIndex('blockchain', ['contract'], {
        name: 'contract_index',
    });
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.removeIndex('shard', 'blockchain_id_index');

    await queryInterface.removeIndex('shard', 'last_dialed_index');

    await queryInterface.removeIndex('service_agreement', 'blockchain_id_index');

    await queryInterface.removeIndex('service_agreement', 'blockchain_id_token_id_index');

    await queryInterface.removeIndex('service_agreement', 'token_id_index');

    await queryInterface.removeIndex('paranet_synced_asset', 'ual_index');

    await queryInterface.changeColumn('paranet_synced_asset', 'data_source', {
        type: Sequelize.TEXT,
        allowNull: true,
    });

    await queryInterface.removeIndex('paranet_synced_asset', 'paranet_ual_data_source_index');

    await queryInterface.removeIndex('paranet', 'blockchain_id_paranet_id_index');

    await queryInterface.removeIndex('missed_paranet_asset', 'paranet_ual_index');

    await queryInterface.removeIndex('missed_paranet_asset', 'ual_index');

    await queryInterface.removeIndex('event', 'name_timestamp_index');

    await queryInterface.removeIndex('event', 'operation_id_index');

    await queryInterface.removeIndex('commands', 'name_status_index');

    await queryInterface.removeIndex('commands', 'status_started_at_index');

    await queryInterface.removeIndex('get', 'operation_id_index');

    await queryInterface.removeIndex('publish', 'operation_id_index');

    await queryInterface.removeIndex('update', 'operation_id_index');

    await queryInterface.removeIndex('publish_paranet', 'operation_id_index');

    await queryInterface.removeIndex('get', 'created_at_index');

    await queryInterface.removeIndex('publish', 'created_at_index');

    await queryInterface.removeIndex('update', 'created_at_index');

    await queryInterface.removeIndex('publish_paranet', 'created_at_index');

    await queryInterface.removeIndex('get_response', 'operation_id_index');

    await queryInterface.removeIndex('publish_response', 'operation_id_index');

    await queryInterface.removeIndex('update_response', 'operation_id_index');

    await queryInterface.removeIndex('publish_paranet_response', 'operation_id_index');

    await queryInterface.removeIndex('get_response', 'created_at_index');

    await queryInterface.removeIndex('publish_response', 'created_at_index');

    await queryInterface.removeIndex('update_response', 'created_at_index');

    await queryInterface.removeIndex('publish_paranet_response', 'created_at_index');

    await queryInterface.removeIndex('blockchain', 'contract_index');
}
