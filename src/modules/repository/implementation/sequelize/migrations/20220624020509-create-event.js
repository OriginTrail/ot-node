export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('event', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        operation_id: {
            type: Sequelize.UUID,
            allowNull: false,
        },
        name: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        timestamp: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        value1: {
            allowNull: true,
            type: Sequelize.STRING,
        },
        value2: {
            allowNull: true,
            type: Sequelize.STRING,
        },
        value3: {
            allowNull: true,
            type: Sequelize.STRING,
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
export async function down(queryInterface) {
    await queryInterface.dropTable('event');
}
