import Command from '../../../command.js';
import { ERROR_TYPE, PRIVATE_ASSERTION_PREDICATE } from '../../../../constants/constants.js';

class GetPrivateAssertionIdCommand extends Command {
    constructor(ctx) {
        super(ctx);

        this.errorType = ERROR_TYPE.GET.GET_PRIVATE_ASSERTION_ID_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, blockchain, assertionId, paranetUAL } = command.data;
        this.logger.info(
            `Getting private assertion id for public assertion id: ${assertionId}, operation id: ${operationId} on blockchain: ${blockchain}`,
        );

        const paranetRepository = this.paranetService.getParanetRepositoryName(paranetUAL);
        const publicAssertion = await this.tripleStoreService.getAssertion(
            paranetRepository,
            assertionId,
        );

        let privateAssertionId;

        const filteredTriples = publicAssertion.filter((element) =>
            element.includes(PRIVATE_ASSERTION_PREDICATE),
        );
        const privateAssertionLinkTriple = filteredTriples.length > 0 ? filteredTriples[0] : null;

        if (privateAssertionLinkTriple) {
            [, privateAssertionId] = privateAssertionLinkTriple.match(/"(.*?)"/);
        }

        let logMsg;
        if (privateAssertionId) {
            logMsg = `Found private assertion id: ${privateAssertionId} for KA with public assertion id: ${assertionId}`;
        } else {
            logMsg = `Not found private assertion id for KA with public assertion id: ${assertionId}`;
        }

        this.logger.info(logMsg);

        return this.continueSequence({ ...command.data, privateAssertionId }, command.sequence);
    }

    async handleError(operationId, blockchain, errorMessage, errorType) {
        await this.operationService.markOperationAsFailed(
            operationId,
            blockchain,
            errorMessage,
            errorType,
        );
    }

    /**
     * Builds default getPrivateAssertionIdCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getPrivateAssertionIdCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default GetPrivateAssertionIdCommand;
