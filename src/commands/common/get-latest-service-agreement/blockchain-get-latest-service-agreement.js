/* eslint-disable no-await-in-loop */
import { setTimeout as sleep } from 'timers/promises';
import Command from '../../command.js';
import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    ETHERS_BLOCK_TAGS,
    EXPECTED_TRANSACTION_ERRORS,
    GET_ASSERTION_IDS_MAX_RETRY_COUNT,
    GET_ASSERTION_IDS_RETRY_DELAY_IN_SECONDS,
    GET_LATEST_SERVICE_AGREEMENT_BATCH_SIZE,
    GET_LATEST_SERVICE_AGREEMENT_FREQUENCY_MILLS,
    SERVICE_AGREEMENT_SOURCES,
} from '../../../constants/constants.js';

class BlockchainGetLatestServiceAgreement extends Command {
    constructor(ctx) {
        super(ctx);
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.ualService = ctx.ualService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { blockchain } = command.data;

        const assetStorageContractAddresses =
            this.blockchainModuleManager.getAssetStorageContractAddresses(blockchain);

        const results = await Promise.all(
            assetStorageContractAddresses.map((contract) =>
                this.updateAgreementDataForAssetContract(
                    contract,
                    blockchain,
                    command.data[contract],
                ),
            ),
        );

        results.forEach((result) => {
            if (result) {
                // eslint-disable-next-line no-param-reassign
                command.data[result.contract] = result.lastProcessedTokenId;
                this.logger.debug(
                    `Get latest service agreement: updating last processed token id: ${result.lastProcessedTokenId} for blockchain ${blockchain}`,
                );
            }
        });

        return Command.repeat();
    }

    async updateAgreementDataForAssetContract(contract, blockchain, lastProcessedTokenId) {
        this.logger.info(
            `Get latest service agreement: Starting get latest service agreement command, last processed token id: ${lastProcessedTokenId} for blockchain: ${blockchain}`,
        );
        let latestBlockchainTokenId;
        try {
            latestBlockchainTokenId = Number(
                await this.blockchainModuleManager.getLatestTokenId(
                    blockchain,
                    contract,
                    ETHERS_BLOCK_TAGS.FINALIZED,
                ),
            );
        } catch (error) {
            if (error.message.includes(EXPECTED_TRANSACTION_ERRORS.NO_MINTED_ASSETS)) {
                this.logger.info(
                    `Get latest service agreement: No minted assets on blockchain: ${blockchain}`,
                );
                return;
            }
            this.logger.error(
                `Unable to process agreement data for asset contract ${contract}. Error: ${error}`,
            );
            return;
        }

        const latestDbTokenId =
            lastProcessedTokenId ??
            (await this.repositoryModuleManager.getLatestServiceAgreementTokenId(blockchain)) ??
            latestBlockchainTokenId;

        if (latestBlockchainTokenId <= latestDbTokenId) {
            this.logger.debug(
                `Get latest service agreement: No new agreements found on blockchain: ${blockchain}.`,
            );
            return {
                contract,
                lastProcessedTokenId: latestDbTokenId,
            };
        }

        this.logger.debug(
            `Get latest service agreement: Latest token id on chain: ${latestBlockchainTokenId}, latest token id in database: ${latestDbTokenId} on blockchain: ${blockchain}`,
        );

        let tokenIdDifference = latestBlockchainTokenId - latestDbTokenId;
        let getAgreementDataPromise = [];
        for (
            let tokenIdToBeFetched = latestDbTokenId + 1;
            tokenIdToBeFetched <= latestBlockchainTokenId;
            tokenIdToBeFetched += 1
        ) {
            getAgreementDataPromise.push(
                this.getAgreementDataForToken(tokenIdToBeFetched, blockchain, contract),
            );
            if (
                getAgreementDataPromise.length === tokenIdDifference ||
                getAgreementDataPromise.length === GET_LATEST_SERVICE_AGREEMENT_BATCH_SIZE
            ) {
                const missingAgreements = await Promise.all(getAgreementDataPromise);

                await this.repositoryModuleManager.bulkCreateServiceAgreementRecords(
                    missingAgreements.filter((agreement) => agreement != null),
                );
                tokenIdDifference -= getAgreementDataPromise.length;
                getAgreementDataPromise = [];
            }
        }

        this.logger.debug(
            `Get latest service agreement: Successfully fetched ${
                latestBlockchainTokenId - latestDbTokenId
            } on blockchain: ${blockchain}`,
        );

        return {
            contract,
            lastProcessedTokenId: latestBlockchainTokenId,
        };
    }

    async getAgreementDataForToken(
        tokenId,
        blockchain,
        contract,
        hashFunctionId = CONTENT_ASSET_HASH_FUNCTION_ID,
    ) {
        try {
            this.logger.debug(
                `Get latest service agreement: Getting agreement data for token id: ${tokenId} on blockchain: ${blockchain}`,
            );
            let assertionIds = [];
            let retryCount = 0;

            while (assertionIds.length === 0) {
                if (retryCount === GET_ASSERTION_IDS_MAX_RETRY_COUNT) {
                    throw Error(
                        `Get latest service agreement: Unable to get assertion ids for token id: ${tokenId} on blockchain: ${blockchain}`,
                    );
                }
                this.logger.debug(
                    `Get latest service agreement: getting assertion ids retry ${retryCount} for token id: ${tokenId} on blockchain: ${blockchain}`,
                );
                assertionIds = await this.blockchainModuleManager.getAssertionIds(
                    blockchain,
                    contract,
                    tokenId,
                    0,
                    ETHERS_BLOCK_TAGS.FINALIZED,
                );
                retryCount += 1;
                await sleep(GET_ASSERTION_IDS_RETRY_DELAY_IN_SECONDS * 1000);
            }

            const keyword = await this.ualService.calculateLocationKeyword(
                blockchain,
                contract,
                tokenId,
                assertionIds[0],
            );
            const agreementId = await this.serviceAgreementService.generateId(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
            );
            const agreementData = await this.blockchainModuleManager.getAgreementData(
                blockchain,
                agreementId,
                ETHERS_BLOCK_TAGS.FINALIZED,
            );

            if (!agreementData) {
                throw Error(
                    `Get latest service agreement: Unable to fetch agreement data while processing asset created event for agreement id: ${agreementId}, blockchain id: ${blockchain}`,
                );
            }

            const latestStateIndex = assertionIds.length - 1;

            return {
                blockchainId: blockchain,
                assetStorageContractAddress: contract,
                tokenId,
                agreementId,
                startTime: agreementData.startTime,
                epochsNumber: agreementData.epochsNumber,
                epochLength: agreementData.epochLength,
                scoreFunctionId: agreementData.scoreFunctionId,
                stateIndex: latestStateIndex,
                assertionId: assertionIds[latestStateIndex],
                hashFunctionId,
                keyword,
                proofWindowOffsetPerc: agreementData.proofWindowOffsetPerc,
                dataSource: SERVICE_AGREEMENT_SOURCES.NODE,
            };
        } catch (error) {
            this.logger.error(error.message);
        }
    }

    /**
     * Recover system from failure
     * @param error
     */
    async recover() {
        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'blockchainGetLatestServiceAgreement',
            data: {},
            period: GET_LATEST_SERVICE_AGREEMENT_FREQUENCY_MILLS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default BlockchainGetLatestServiceAgreement;
