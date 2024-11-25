export async function up({ context: { queryInterface } }) {
    await queryInterface.renameColumn('publish_response', 'keyword', 'dataset_root');
    await queryInterface.renameColumn('get_response', 'keyword', 'dataset_root');
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.renameColumn('publish_response', 'dataset_root', 'keyword');
    await queryInterface.renameColumn('get_response', 'dataset_root', 'keyword');
}
