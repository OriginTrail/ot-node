import UalService from './ual-service.js';

class ParanetIdService extends UalService {
    getParanetRepositoryName(paranetId) {
        if (this.isUAL(paranetId)) {
            return paranetId.replace('/', '-');
        }
        throw new Error(
            `Unable to get Paranet repository name. Paranet id doesn't have correct format: ${paranetId}`,
        );
    }
}

export default ParanetIdService;
