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

    async updateHandlerIdRecord(data, condition) {
        if (this.initialized) {
            return this.getImplementation().module.updateHandlerIdRecord(data, condition);
        }
    }
}

module.exports = RepositoryModuleManager;
