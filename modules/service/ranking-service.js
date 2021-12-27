class RankingService {
    constructor(ctx) {
        this.logger = ctx.logger;
    }

    initialize(implementations) {
        this.rankingImplementations = implementations;
        Object.keys(implementations).forEach((key, index) => {
            implementations[key].initialize(this.logger);
        });
    }

    async rank(nodes, topic, rankingTypes) {
        let rankedNodes = [];
        for (const type of rankingTypes) {
            rankedNodes = await this.rankingImplementations[type].execute(nodes, topic);
        }
        return rankedNodes;
    }
}

module.exports = RankingService;
