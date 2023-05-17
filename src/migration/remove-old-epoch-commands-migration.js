import BaseMigration from './base-migration.js';

class RemoveOldEpochCommandsMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        const commandsToDestroy = [
            'epochCheckCommand',
            'calculateProofsCommand',
            'submitCommitCommand',
            'submitProofsCommand',
        ];

        await Promise.all(
            commandsToDestroy.map((command) =>
                this.repositoryModuleManager.destroyCommand(command),
            ),
        );
    }
}

export default RemoveOldEpochCommandsMigration;
