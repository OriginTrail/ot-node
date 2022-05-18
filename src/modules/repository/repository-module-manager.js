const BaseModuleManager = require('../base-module-manager');

class RepositoryModuleManager extends BaseModuleManager {
    getName() {
        return 'repository';
    }

    migrate() {
        this.getImplementation().module.migrate();
    }
}

module.exports = RepositoryModuleManager;
