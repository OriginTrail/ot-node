export async function up({ context: { queryInterface } }) {
    await queryInterface.renameTable('finality', 'ask');
    await queryInterface.renameTable('finality_response', 'ask_response');
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.renameTable('ask', 'finality');
    await queryInterface.renameTable('ask_response', 'finality_response');
}
