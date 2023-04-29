import Command from '../../command.js';
import { NETWORK_MESSAGE_TYPES } from '../../../constants/constants.js';

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
            const { messageType, messageData } = await this.prepareMessage(command.data);
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
                this.logger.warn(error.message);
                return Command.retry();
            }
            await this.handleError(error.message, command);
        }

        return Command.empty();
    }

    async prepareMessage() {
        throw Error('prepareMessage not implemented');
    }

    async validateNeighborhood(blockchain, keyword, hashFunctionId, ual) {
        const closestNodes = await this.shardingTableService.findNeighbourhood(
            blockchain,
            keyword,
            await this.blockchainModuleManager.getR2(blockchain),
            hashFunctionId,
            true,
        );
        for (const { peer_id } of closestNodes) {
            if (peer_id === this.networkModuleManager.getPeerIdString()) {
                return true;
            }
        }
        this.logger.warn(`Invalid neighborhood for ual: ${ual}`);

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
                `Invalid assertion id for asset ${ual}. Received value from blockchain: ${blockchainAssertionId}, received value from request: ${assertionId}`,
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
        const geAgreementData = async () => {
            const agreementId = await this.serviceAgreementService.generateId(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
            );
            this.logger.info(
                `Calculated agreement id: ${agreementId} for contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, hash function id: ${hashFunctionId}, operationId: ${operationId}`,
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
                this.networkModuleManager.getPeerIdString(),
                blockchain,
            );

            const ask = this.blockchainModuleManager.convertToWei(blockchain, peerRecord.ask);

            return this.blockchainModuleManager.toBigNumber(blockchain, ask);
        };

        const [{ agreementId, agreementData }, blockchainAssertionSize, r0, ask] =
            await Promise.all([
                geAgreementData(),
                this.blockchainModuleManager.getAssertionSize(blockchain, assertionId),
                this.blockchainModuleManager.getR0(blockchain),
                getAsk(),
            ]);

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

        const serviceAgreementBid = this.blockchainModuleManager
            .toBigNumber(blockchain, agreementData.tokenAmount)
            .add(agreementData.updateTokenAmount)
            .mul(1024)
            .div(divisor)
            .add(1); // add 1 wei because of the precision loss

        const bidAskLog = `Service agreement bid: ${serviceAgreementBid}, ask: ${ask}, operationId: ${operationId}`;
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

        this.logger.trace(`Validating neighborhood for ual: ${ual}`);
        if (!(await this.validateNeighborhood(blockchain, keyword, hashFunctionId, ual))) {
            return {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                messageData: { errorMessage: 'Invalid neighbourhood' },
            };
        }

        this.logger.trace(`Validating assertion with ual: ${ual}`);
        await this.validateAssertionId(blockchain, contract, tokenId, assertionId, ual);
        this.logger.trace(`Validating bid for asset with ual: ${ual}`);
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

    async handleError(errorMessage, command) {
        const { operationId, remotePeerId, keywordUuid, protocol } = command.data;

        await super.handleError(operationId, errorMessage, this.errorType, true);
        await this.networkModuleManager.sendMessageResponse(
            protocol,
            remotePeerId,
            NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
            operationId,
            keywordUuid,
            { errorMessage },
        );
    }
}

export default HandleProtocolMessageCommand;
