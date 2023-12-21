const newRoutes = [
    'V0/PUBLISH',
    'V0/UPDATE',
    'V0/GET',
    'V0/QUERY',
    'V0/OPERATION_RESULT',
    'V0/INFO',
    'V0/BID-SUGGESTION',
    'V0/LOCAL-STORE',
];
const outdatedRoutes = ['PROVISION', 'SEARCH', 'SEARCH_ASSERTION', 'PROOFS'];

async function getAbilityIds(names, queryInterface, transaction) {
    const [abilities] = await queryInterface.sequelize.query(
        `SELECT id FROM ability WHERE name IN (${names.map((name) => `'${name}'`).join(', ')})`,
        { transaction },
    );
    return abilities.map((ability) => ability.id);
}

async function getAdminRoleId(queryInterface, transaction) {
    const [[role]] = await queryInterface.sequelize.query(
        "SELECT id FROM role WHERE name='ADMIN'",
        { transaction },
    );

    return role.id;
}

async function getRoleAbilities(names, queryInterface, transaction) {
    const abilityIds = await getAbilityIds(names, queryInterface, transaction);
    const adminRoleId = await getAdminRoleId(queryInterface, transaction);

    return abilityIds.map((abilityId) => ({
        ability_id: abilityId,
        role_id: adminRoleId,
    }));
}

async function removeAbilities(names, queryInterface, transaction) {
    const adminRoleId = await getAdminRoleId(queryInterface, transaction);
    const abilityIds = await getAbilityIds(names, queryInterface, transaction);

    await queryInterface.bulkDelete(
        'role_ability',
        {
            role_id: adminRoleId,
            ability_id: abilityIds,
        },
        { transaction },
    );

    await queryInterface.bulkDelete('ability', { id: abilityIds }, { transaction });
}

async function addAbilities(names, queryInterface, transaction) {
    await queryInterface.bulkInsert(
        'ability',
        names.map((name) => ({ name })),
        { transaction },
    );
    await queryInterface.bulkInsert(
        'role_ability',
        await getRoleAbilities(names, queryInterface, transaction),
        { transaction },
    );
}

export async function up({ context: { queryInterface } }) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
        await addAbilities(newRoutes, queryInterface, transaction);
        await removeAbilities(outdatedRoutes, queryInterface, transaction);
        transaction.commit();
    } catch (e) {
        transaction.rollback();
        throw e;
    }
}

export async function down({ context: { queryInterface } }) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
        await removeAbilities(newRoutes, queryInterface, transaction);
        await addAbilities(outdatedRoutes, queryInterface, transaction);
        transaction.commit();
    } catch (e) {
        transaction.rollback();
        throw e;
    }
}
