export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.createTable('publish_finality', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        operation_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        ual: {
            allowNull: true,
            type: Sequelize.STRING,
        },
        peer_id: {
            allowNull: false,
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
    await queryInterface.addConstraint('publish_finality', {
        fields: ['ual', 'peer_id'],
        type: 'unique',
    });
}
export async function down({ context: { queryInterface } }) {
    await queryInterface.dropTable('publish_finality');
}
