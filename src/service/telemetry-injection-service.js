class TelemetryInjectionService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.eventEmitter = ctx.eventEmitter;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.listenOnEvents();
    }

    listenOnEvents() {
        // get list of events and listen
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
