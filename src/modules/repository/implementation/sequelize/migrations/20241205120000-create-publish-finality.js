export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.createTable('publish_finality', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        blockchainId: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        ual: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        finality: {
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
    await queryInterface.createTable('publish_finality_peers', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        ual: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        peerId: {
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
}
export async function down({ context: { queryInterface } }) {
    await queryInterface.dropTable('publish_finality');
    await queryInterface.dropTable('publish_finality_peers');
}
