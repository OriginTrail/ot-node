const KadIdentityRanking = require('../../external/kad-identity-ranking-service');

class RankingService {
    constructor(ctx) {
        this.logger = ctx.logger;
    }

    initialize() {
        // TODO: Initialize array of ranking implementations
        this.implementation = new KadIdentityRanking();
        this.implementation.initialize(this.logger);
    }

    async rank(nodes, topic, rankingTypes) {
        let rankedNodes = [];
        // TODO: Iterate and execute all ranking implementations provided in rankingTypes
        rankedNodes = await this.implementation.execute(nodes, topic);
        return rankedNodes;
    }
}

module.exports = RankingService;
