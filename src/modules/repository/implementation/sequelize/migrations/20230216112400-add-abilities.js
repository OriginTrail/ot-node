const newRoutes = ['BID-SUGGESTION', 'LOCAL-STORE'];

async function getRoleAbilities(names, queryInterface, transaction) {
    const [abilities] = await queryInterface.sequelize.query(
        `SELECT id from ability where name IN (${names.map((name) => `'${name}'`).join(', ')})`,
        {
            transaction,
        },
    );

    const [[role]] = await queryInterface.sequelize.query(
        "SELECT id from role where name='ADMIN'",
        {
            transaction,
        },
    );

    return abilities.map((ability) => ({
        ability_id: ability.id,
        role_id: role.id,
    }));
}

async function removeAbilities(names, queryInterface, transaction) {
    await queryInterface.bulkDelete(
        'role_ability',
        await getRoleAbilities(names, queryInterface, transaction),
        { transaction },
    );
    await queryInterface.bulkDelete(
        'ability',
        names.map((name) => ({ name })),
        { transaction },
    );
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
        transaction.commit();
    } catch (e) {
        transaction.rollback();
        throw e;
    }
}
