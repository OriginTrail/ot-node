const BaseModuleManager = require('../base-module-manager');

class RepositoryModuleManager extends BaseModuleManager {
    getName() {
        return 'repository';
    }

    // HANDLER ID TABLE
    async createHandlerIdRecord(handlerData) {
        if (this.initialized) {
            return this.getImplementation().module.createHandlerIdRecord(handlerData);
        }
    }

    async updateHandlerIdRecord(data, handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.updateHandlerIdRecord(data, handlerId);
        }
    }

    async getHandlerIdRecord(handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.getHandlerIdRecord(handlerId);
        }
    }

    // publish TABLE
    async createPublishRecord(status) {
        if (this.initialized) {
            return this.getImplementation().module.createPublishRecord(status);
        }
    }

    async updatePublishRecord(data, publishId) {
        if (this.initialized) {
            return this.getImplementation().module.updatePublishRecord(data, publishId);
        }
    }

    async getNumberOfNodesFoundForPublish(publishId) {
        if (this.initialized) {
            return this.getImplementation().module.getNumberOfNodesFoundForPublish(publishId);
        }
    }

    // PUBLISH REQUEST TABLE
    async createPublishRequestRecord(status, publishId, message = null) {
        if (this.initialized) {
            return this.getImplementation().module.createPublishRequestRecord(status, publishId, message);
        }
    }

    async updatePublishResponseRecord(data, condition) {
        if (this.initialized) {
            return this.getImplementation().module.updatePublishResponseRecord(data, condition);
        }
    }

    async getNumberOfPublishResponses(publishId) {
        if (this.initialized) {
            return this.getImplementation().module.getNumberOfPublishResponses(publishId);
        }
    }
}

module.exports = RepositoryModuleManager;
