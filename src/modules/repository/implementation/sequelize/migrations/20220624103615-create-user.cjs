export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('user', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        name: {
            type: Sequelize.STRING,
            unique: true,
        },
        role_id: {
            type: Sequelize.INTEGER,
            references: {
                model: 'role',
                key: 'id',
            },
        },
        created_at: {
            allowNull: true,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('NOW()'),
        },
        updated_at: {
            allowNull: true,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('NOW()'),
        },
    });
}
export async function down(queryInterface) {
    await queryInterface.dropTable('user');
}
