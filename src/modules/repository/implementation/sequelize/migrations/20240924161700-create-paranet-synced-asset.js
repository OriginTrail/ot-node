export const up = async ({ context: { queryInterface, Sequelize } }) => {
    await queryInterface.createTable('paranet_synced_asset', {
        id: {
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        blockchain_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        ual: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        paranet_ual: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        public_assertion_id: {
            allowNull: true,
            type: Sequelize.STRING,
        },
        private_assertion_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        sender: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        transaction_hash: {
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

    await queryInterface.sequelize.query(`
        CREATE TRIGGER before_insert_paranet_synced_asset
        BEFORE INSERT ON paranet_synced_asset
        FOR EACH ROW
        SET NEW.created_at = NOW();
    `);

    await queryInterface.sequelize.query(`
        CREATE TRIGGER before_update_paranet_synced_asset
        BEFORE UPDATE ON paranet_synced_asset
        FOR EACH ROW
        SET NEW.updated_at = NOW();
    `);

    await queryInterface.sequelize.query(`
        CREATE INDEX idx_paranet_ual_created_at
        ON paranet_synced_asset (paranet_ual, created_at);
    `);

    await queryInterface.sequelize.query(`
        CREATE INDEX idx_sender
        ON paranet_synced_asset (sender);    
    `);

    await queryInterface.sequelize.query(`
        CREATE INDEX idx_paranet_ual_unique
        ON paranet_synced_asset (paranet_ual);    
    `);
};

export const down = async ({ context: { queryInterface } }) => {
    await queryInterface.dropTable('paranet_synced_asset');

    await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS before_insert_paranet_synced_asset;
    `);

    // Delete the before-update trigger
    await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS before_update_paranet_synced_asset;
    `);
};
