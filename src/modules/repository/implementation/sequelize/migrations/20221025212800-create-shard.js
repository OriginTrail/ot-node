export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.createTable('shard', {
        peer_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        blockchain_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        ask: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        stake: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        last_seen: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: new Date(0),
        },
        last_dialed: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: new Date(0),
        },
        sha256: {
            type: Sequelize.STRING,
            allowNull: false,
        },
    });
}
export async function down({ context: { queryInterface } }) {
    await queryInterface.dropTable('shard');
}
