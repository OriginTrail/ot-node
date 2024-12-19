export async function up({ context: { queryInterface } }) {
    await queryInterface.removeColumn('publish_response', 'dataset_root');
    await queryInterface.removeColumn('get_response', 'dataset_root');
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('publish_response', 'dataset_root', {
        type: Sequelize.STRING,
        allowNull: false,
    });
    await queryInterface.addColumn('get_response', 'dataset_root', {
        type: Sequelize.STRING,
        allowNull: false,
    });
}
