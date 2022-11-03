export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.createTable('blockchain', {
        blockchain_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        contract: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        last_checked_block: {
            type: Sequelize.BIGINT,
            allowNull: false,
            defaultValue: -1,
        },
        last_checked_timestamp: {
            type: Sequelize.BIGINT,
            allowNull: false,
            defaultValue: 0,
        },
    });
}
export async function down({ context: { queryInterface } }) {
    await queryInterface.dropTable('blockchain');
}
