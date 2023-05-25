import { createRequire } from 'module';
import BaseController from './base-http-api-controller.js';

const require = createRequire(import.meta.url);
const { version } = require('../../../package.json');

class InfoController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async handleInfoRequest(req, res) {
        const response = {
            version,
        };
        response.assetSyncEnabled = this.config.assetSync.enabled;
        if (response.assetSyncEnabled) {
            response.assetSyncStatus = [];
            await Promise.all(
                this.blockchainModuleManager.getImplementationNames().map(async (blockchain) => {
                    await Promise.all(
                        this.blockchainModuleManager
                            .getAssetStorageAddresses(blockchain)
                            .map(async (assetContractAddress) => {
                                try {
                                    const latestCreatedKnowledgeAssetTokenId =
                                        await this.blockchainModuleManager.getLatestTokenId(
                                            blockchain,
                                            assetContractAddress,
                                        );
                                    const latestSyncedKnowledgeAsset =
                                        await this.repositoryModuleManager.getLatestAssetSyncRecord(
                                            blockchain,
                                            assetContractAddress,
                                        );
                                    response.assetSyncStatus.push({
                                        blockchain,
                                        assetContractAddress,
                                        latestCreatedKnowledgeAssetTokenId: Number(
                                            latestCreatedKnowledgeAssetTokenId,
                                        ),
                                        latestSyncedKnowledgeAssetTokenId:
                                            latestSyncedKnowledgeAsset.tokenId,
                                    });
                                } catch (error) {
                                    this.logger.warn(
                                        `Error while trying to get asset sync status for blockchain: ${blockchain} and contract: ${assetContractAddress}`,
                                    );
                                }
                            }),
                    );
                }),
            );
        }

        this.returnResponse(res, 200, response);
    }
}

export default InfoController;
