const BaseModuleManager = require('../base-module-manager');

class RepositoryModuleManager extends BaseModuleManager {
    getName() {
        return 'repository';
    }

    async createHandlerIdRecord(handlerData) {
        if (this.initialized) {
            return this.getImplementation().module.createHandlerIdRecord(handlerData);
        }
    }
}

module.exports = RepositoryModuleManager;
