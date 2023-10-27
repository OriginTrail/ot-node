import Command from '../../command.js';
import { BYTES_IN_KILOBYTE, NETWORK_MESSAGE_TYPES } from '../../../constants/constants.js';

class HandleProtocolMessageCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.ualService = ctx.ualService;
        this.networkModuleManager = ctx.networkModuleManager;
        this.operationIdService = ctx.operationIdService;
        this.shardingTableService = ctx.shardingTableService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { remotePeerId, operationId, keywordUuid, protocol } = command.data;

        try {
            const { messageType, messageData } = await this.prepareMessage(command);
            await this.networkModuleManager.sendMessageResponse(
                protocol,
                remotePeerId,
                messageType,
                operationId,
                keywordUuid,
                messageData,
            );
        } catch (error) {
            if (command.retries) {
                this.logger.warn(
                    `Error occurred during the command execution; ` +
                        `Error Message: ${error.message}. Retrying the command...`,
                    command,
                );
                return Command.retry();
            }
            await this.handleError(command, error.message);
        }

        this.networkModuleManager.removeCachedSession(operationId, keywordUuid, remotePeerId);

        return Command.empty();
    }

    async prepareMessage() {
        throw Error('prepareMessage is not implemented.');
    }

    async validateNeighborhood(blockchain, keyword, hashFunctionId, ual) {
        const closestNodes = await this.shardingTableService.findNeighbourhood(
            blockchain,
            keyword,
            await this.blockchainModuleManager.getR2(blockchain),
            hashFunctionId,
            true,
        );
        const peerId = this.networkModuleManager.getPeerId().toB58String();
        for (const { peerId: otherPeerId } of closestNodes) {
            if (otherPeerId === peerId) {
                return true;
            }
        }

        this.logger.warn(`Invalid neighborhood for the UAL: ${ual}`);

        return false;
    }

    async validateAssertionId(blockchain, contract, tokenId, assertionId, ual) {
        const blockchainAssertionId = await this.blockchainModuleManager.getLatestAssertionId(
            blockchain,
            contract,
            tokenId,
        );
        if (blockchainAssertionId !== assertionId) {
            throw Error(
                `Invalid Assertion ID for the Knowledge Asset with the UAL: ${ual}. ` +
                    `Value from the blockchain: ${blockchainAssertionId}; ` +
                    `Value from the request: ${assertionId}.`,
            );
        }
    }

    async validateBid(
        contract,
        tokenId,
        keyword,
        hashFunctionId,
        blockchain,
        assertionId,
        operationId,
    ) {
        const getAgreementData = async () => {
            const agreementId = await this.serviceAgreementService.generateId(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
            );

            return {
                agreementId,
                agreementData: await this.blockchainModuleManager.getAgreementData(
                    blockchain,
                    agreementId,
                ),
            };
        };

        const getAsk = async () => {
            const peerRecord = await this.repositoryModuleManager.getPeerRecord(
                this.networkModuleManager.getPeerId().toB58String(),
                blockchain,
            );

            const ask = this.blockchainModuleManager.convertToWei(blockchain, peerRecord.ask);

            return this.blockchainModuleManager.toBigNumber(blockchain, ask);
        };

        const [{ agreementId, agreementData }, blockchainAssertionSize, r0, ask] =
            await Promise.all([
                getAgreementData(),
                this.blockchainModuleManager.getAssertionSize(blockchain, assertionId),
                this.blockchainModuleManager.getR0(blockchain),
                getAsk(),
            ]);
        const blockchainAssertionSizeInKb = blockchainAssertionSize / BYTES_IN_KILOBYTE;
        if (blockchainAssertionSizeInKb > this.config.maximumAssertionSizeInKb) {
            this.logger.warn(
                `The size of the received Assertion for the Service Agreement ` +
                    `with ID: ${agreementId} exceeds the maximum limit allowed. ` +
                    `Maximum allowed assertion size: ${this.config.maximumAssertionSizeInKb} KB; ` +
                    `Assertion size read from blockchain: ${blockchainAssertionSizeInKb} KB.`,
            );
            return {
                errorMessage:
                    `The size of the received Assertion for the Service Agreement ` +
                    `with ID: ${agreementId} exceeds the maximum limit allowed.`,
                agreementId,
                agreementData,
            };
        }

        const now = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);

        // todo: use shared function with epoch commands
        const currentEpoch = Math.floor(
            (Number(now) - Number(agreementData.startTime)) / Number(agreementData.epochLength),
        );

        // todo: consider optimizing to take into account cases where some proofs have already been submitted
        const epochsLeft = Number(agreementData.epochsNumber) - currentEpoch;

        const divisor = this.blockchainModuleManager
            .toBigNumber(blockchain, r0)
            .mul(epochsLeft)
            .mul(blockchainAssertionSize);

        const serviceAgreementBid = agreementData.tokenAmount
            .add(agreementData.updateTokenAmount)
            .mul(1024)
            .div(divisor)
            .add(1); // add 1 wei because of the precision loss

        const bidAskLog = `Operation ID: ${operationId}; Service Agreement Bid: ${serviceAgreementBid}; Node Ask: ${ask}.`;
        this.logger.trace(bidAskLog);

        return {
            errorMessage: ask.lte(serviceAgreementBid) ? null : bidAskLog,
            agreementId,
            agreementData,
        };
    }

    async validateReceivedData(
        operationId,
        assertionId,
        blockchain,
        contract,
        tokenId,
        keyword,
        hashFunctionId,
    ) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.trace(`Validating neighborhood for the Knowledge Asset with the UAL: ${ual}.`);
        if (!(await this.validateNeighborhood(blockchain, keyword, hashFunctionId, ual))) {
            return {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                messageData: {
                    errorMessage: `Invalid neighbourhood for the Knowledge Asset with the UAL: ${ual}.`,
                },
            };
        }

        this.logger.trace(`Validating Assertion for the Knowledge Asset with the UAL: ${ual}.`);
        await this.validateAssertionId(blockchain, contract, tokenId, assertionId, ual);
        this.logger.trace(`Validating Bid for the Knowledge Asset with the UAL: ${ual}.`);
        const { errorMessage, agreementId, agreementData } = await this.validateBid(
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            blockchain,
            assertionId,
            operationId,
        );

        if (errorMessage) {
            return {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                messageData: { errorMessage },
            };
        }

        await this.operationIdService.cacheOperationIdData(operationId, {
            assertionId,
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            agreementId,
            agreementData,
        });

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    async handleError(command, errorMessage) {
        const { operationId, remotePeerId, keywordUuid, protocol } = command.data;

        await super.handleError(operationId, command, this.errorType, errorMessage, true);
        await this.networkModuleManager.sendMessageResponse(
            protocol,
            remotePeerId,
            NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
            operationId,
            keywordUuid,
            { errorMessage },
        );
        this.networkModuleManager.removeCachedSession(operationId, keywordUuid, remotePeerId);
    }
}

export default HandleProtocolMessageCommand;
