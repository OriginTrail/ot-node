export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.createTable('finality_status', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        operation_id: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        ual: {
            type: Sequelize.STRING,
        },
        peer_id: {
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
    await queryInterface.addConstraint('finality_status', {
        fields: ['ual', 'peer_id'],
        type: 'unique',
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.dropTable('finality_status');
}
