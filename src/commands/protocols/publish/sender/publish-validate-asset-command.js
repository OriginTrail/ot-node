import ValidateAssetCommand from '../../../common/validate-asset-command.js';
import Command from '../../../command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    LOCAL_STORE_TYPES,
    PARANET_ACCESS_POLICY,
} from '../../../../constants/constants.js';

class PublishValidateAssetCommand extends ValidateAssetCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_VALIDATE_ASSET_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_VALIDATE_ASSET_START;
        this.operationEndEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_VALIDATE_ASSET_END;
        this.paranetExistsStartEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_VALIDATE_ASSET_PARANET_EXISTS_START;
        this.paranetExistsEndEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_VALIDATE_ASSET_PARANET_EXISTS_END;
        this.nodesAccessPolicyCheckStartEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_VALIDATE_ASSET_NODES_ACCESS_POLICY_CHECK_START;
        this.nodesAccessPolicyCheckEndEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_VALIDATE_ASSET_NODES_ACCESS_POLICY_CHECK_END;
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
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            operationId,
            blockchain,
            storeType = LOCAL_STORE_TYPES.TRIPLE,
            paranetUAL,
            datasetRoot,
        } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            this.operationStartEvent,
        );

        const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);
        const isValidAssertion = await this.validationService.validateDatasetRoot(
            cachedData.dataset,
            datasetRoot,
        );

        if (!isValidAssertion) {
            await this.handleError(
                operationId,
                blockchain,
                `Invalid dataset root for assertion. Received value received value from request: ${cachedData.datasetRoot}`,
                this.errorType,
            );
            return Command.empty();
        }

        let paranetId;
        if (storeType === LOCAL_STORE_TYPES.TRIPLE_PARANET) {
            try {
                const {
                    blockchain: paranetBlockchain,
                    contract: paranetContract,
                    tokenId: paranetTokenId,
                } = this.ualService.resolveUAL(paranetUAL);

                paranetId = this.paranetService.constructParanetId(
                    paranetBlockchain,
                    paranetContract,
                    paranetTokenId,
                );

                this.operationIdService.emitChangeEvent(
                    this.paranetExistsStartEvent,
                    operationId,
                    blockchain,
                );
                const paranetExists = await this.blockchainModuleManager.paranetExists(
                    paranetBlockchain,
                    paranetId,
                );
                this.operationIdService.emitChangeEvent(
                    this.paranetExistsEndEvent,
                    operationId,
                    blockchain,
                );

                if (!paranetExists) {
                    await this.handleError(
                        operationId,
                        blockchain,
                        `Paranet: ${paranetId} doesn't exist.`,
                        this.errorType,
                    );
                    return Command.empty();
                }

                this.operationIdService.emitChangeEvent(
                    this.nodesAccessPolicyCheckStartEvent,
                    operationId,
                    blockchain,
                );
                const nodesAccessPolicy = await this.blockchainModuleManager.getNodesAccessPolicy(
                    blockchain,
                    paranetId,
                );
                if (nodesAccessPolicy === PARANET_ACCESS_POLICY.CURATED) {
                    const identityId = await this.blockchainModuleManager.getIdentityId(blockchain);
                    const isCuratedNode = await this.blockchainModuleManager.isCuratedNode(
                        blockchain,
                        paranetId,
                        identityId,
                    );
                    if (!isCuratedNode) {
                        await this.handleError(
                            operationId,
                            blockchain,
                            `Node is not part of curated paranet ${paranetId}  because node with id ${identityId} is not a curated node.`,
                            this.errorType,
                        );
                        return Command.empty();
                    }
                } else {
                    await this.handleError(
                        operationId,
                        blockchain,
                        `Paranet ${paranetId} is not curated paranet.`,
                        this.errorType,
                    );
                    return Command.empty();
                }
                this.operationIdService.emitChangeEvent(
                    this.nodesAccessPolicyCheckEndEvent,
                    operationId,
                    blockchain,
                );
            } catch (error) {
                await this.handleError(operationId, blockchain, error.message, this.errorType);
                return Command.empty();
            }
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            this.operationEndEvent,
        );
        return this.continueSequence(
            { ...command.data, paranetId, retry: undefined, period: undefined },
            command.sequence,
        );
    }

    /**
     * Builds default publishValidateAssetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishValidateAssetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishValidateAssetCommand;
