class TelemetryInjectionService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.eventEmitter = ctx.eventEmitter;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    initialize() {
        this.listenOnEvents();
    }

    listenOnEvents() {
        this.eventEmitter.on('operation_status_changed', (eventData) => {
            this.repositoryModuleManager.createEventRecord(
                eventData.operationId,
                eventData.lastEvent,
                eventData.timestamp,
                eventData.value1,
                eventData.value2,
            );
        });
    }

    async getUnpublishedEvents(options) {
        return this.repositoryModuleManager.getUnpublishedEvents(options);
    }

    async removePublishedEvents(events) {
        const ids = events.map((event) => event.id);

        await this.repositoryModuleManager.destroyEvents(ids);
    }
}

module.exports = TelemetryInjectionService;
