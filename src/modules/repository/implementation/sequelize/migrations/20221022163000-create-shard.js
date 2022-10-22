export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.createTable('shard', {
        peer_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        ask: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
        stake: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        ip_address: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        last_seen: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
        },
        public_address: {
            type: Sequelize.STRING,
            allowNull: false,
        },
    });
}
export async function down({ context: { queryInterface } }) {
    await queryInterface.dropTable('publish_response');
}
