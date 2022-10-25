export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.createTable('blockchain_event', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        contract: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        blockchain_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        event: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data: {
            allowNull: false,
            type: Sequelize.TEXT('long'),
        },
        block: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        finished: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        created_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('NOW()'),
        },
        updated_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('NOW()'),
        },
    });
}
export async function down({ context: { queryInterface } }) {
    await queryInterface.dropTable('blockchain_event');
}
