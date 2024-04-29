class ParanetRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.paranet;
    }

    async getParanet(paranetId) {
        return this.model.findOne({
            where: {
                paranetId,
            },
        });
    }
}

export default ParanetRepository;
