const KadIdentityRanking = require('../../external/kad-identity-ranking-service');

class RankingService {
    constructor(ctx) {
        this.logger = ctx.logger;
    }

    initialize() {
        this.implementation = new KadIdentityRanking();
        this.implementation.initialize(this.logger);
        // Object.keys(implementations).forEach((key, index) => {
        //     implementations[key].initialize(this.logger);
        // });
    }

    async rank(nodes, topic, rankingTypes) {
        let rankedNodes = [];
        // for (const type of rankingTypes) {
        //     rankedNodes = await this.implementation[type].execute(nodes, topic);
        // }
        rankedNodes = await this.implementation.execute(nodes, topic);
        return rankedNodes;
    }
}

module.exports = RankingService;
