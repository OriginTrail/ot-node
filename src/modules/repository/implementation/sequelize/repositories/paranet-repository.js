class ParanetRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.paranet;
    }

    async getParanet(paranetId) {
        return this.model.findOrCreate({
            where: {
                paranetId,
            },
            defaults: {
                paranetId,
                kaCount: 0,
            },
        });
    }

    async updateParanetKaCount(paranetId, kaCount) {
        await this.model.update(
            { kaCount },
            {
                where: {
                    paranetId,
                },
            },
        );
    }
}

export default ParanetRepository;
