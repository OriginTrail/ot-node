export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.createTable('finality_response', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        operation_id: {
            type: Sequelize.UUID,
            allowNull: false,
        },
        keyword: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        status: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        message: {
            allowNull: true,
            type: Sequelize.TEXT,
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
    await queryInterface.dropTable('finality_response');
}
