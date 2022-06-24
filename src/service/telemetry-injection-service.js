
class TelemetryInjectionService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.eventEmitter = ctx.eventEmitter;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

    }

    initialize() {
        this.listenOnEvents();
    }

    listenOnEvents() {
        this.eventEmitter.on('operation_status_changed', (eventData) => {
            this.repositoryModuleManager.createEventRecord(
                eventData.handlerId,
                eventData.lastEvent,
                eventData.timestamp,
            );
        });

    }

    async getUnpublishedEvents() {
        return this.repositoryModuleManager.getAllEvents();
    }

    async removePublishedEvents(events) {
        const ids = events.map((event) => event.id);

        await this.repositoryModuleManager.destroyEvents(ids);
    }
}

module.exports = TelemetryInjectionService;
