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

    // resolve table
    async createResolveRecord(status) {
        if (this.initialized) {
            return this.getImplementation().module.createResolveRecord(status);
        }
    }

    async updatePublishRecord(data, publishId) {
        if (this.initialized) {
            return this.getImplementation().module.updatePublishRecord(data, publishId);
        }
    }

    async getNumberOfNodesFoundForPublish(publishId) {
        if (this.initialized) {
            return this.getImplementation().module.createPublishResponseRecord(
                status,
                handlerId,
                message,
            );
        }
    }

    async updatePublishResponseRecord(data, condition) {
        if (this.initialized) {
            return this.getImplementation().module.createPublishRequestRecord(
                status,
                publishId,
                message,
            );
        }
    }

    async createResolveResponseRecord(status, resolveId, message = null) {
        if (this.initialized) {
            return this.getImplementation().module.createResolveResponseRecord(
                status,
                resolveId,
                message,
            );
        }
    }

    async getNumberOfPublishResponses(handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.getNumberOfPublishResponses(handlerId);
        }
    }

    async getPublishResponsesStatuses(handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.getPublishResponsesStatuses(handlerId);
        }
    }

    async getNumberOfResolveResponses(resolveId) {
        if (this.initialized) {
            return this.getImplementation().module.getNumberOfResolveResponses(resolveId);
        }
    }
}

module.exports = RepositoryModuleManager;
