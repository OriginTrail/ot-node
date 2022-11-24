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
                eventData.value3,
            );
        });
    }

    async getUnpublishedEvents() {
        return this.repositoryModuleManager.getUnpublishedEvents();
    }

    async removePublishedEvents(events) {
        const ids = events.map((event) => event.id);

        await this.repositoryModuleManager.destroyEvents(ids);
    }
}

export default TelemetryInjectionService;
