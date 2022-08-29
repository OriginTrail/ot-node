export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('token', {
        id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        name: {
            allowNull: false,
            type: Sequelize.STRING,
            unique: true,
        },
        user_id: {
            type: Sequelize.INTEGER,
            references: {
                model: 'user',
                key: 'id',
            },
        },
        expires_at: {
            type: Sequelize.DATE,
            allowNull: true,
        },
        revoked: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
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
    await queryInterface.dropTable('token');
}
