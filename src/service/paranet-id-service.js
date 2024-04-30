class ParanetIdService {
    constructor(ctx) {
        this.ualService = ctx.ualService;
    }

    getParanetRepositoryName(paranetId) {
        if (this.ualService.isUAL(paranetId)) {
            return paranetId.replace('/', '-');
        }
        throw new Error(
            `Unable to get Paranet repository name. Paranet id doesn't have correct format: ${paranetId}`,
        );
    }
}

export default ParanetIdService;
