export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.createTable('publish_finality', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        operationId: {
            allowNull: false,
            type: Sequelize.STRING,
            unique: true,
        },
        ual: {
            allowNull: true,
            type: Sequelize.STRING,
            unique: true,
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
        operationId: {
            allowNull: false,
            type: Sequelize.STRING,
            unique: true,
        },
        ual: {
            allowNull: true,
            type: Sequelize.STRING,
            unique: true,
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
    await queryInterface.addIndex('publish_finality_peers', ['ual', 'peerId'], {
        indicesType: 'UNIQUE',
    });
}
export async function down({ context: { queryInterface } }) {
    await queryInterface.dropTable('publish_finality');
    await queryInterface.dropTable('publish_finality_peers');
}
