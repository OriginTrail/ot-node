'use-strict';

const Models = require('../models');
const MerkleTree = require('./Merkle');
const Challenge = require('./Challenge');
const Graph = require('./Graph');
const ImportUtilities = require('./ImportUtilities');

const { Op } = Models.Sequelize;

const intervalMs = 1500;

class Challenger {
    constructor(ctx) {
        this.log = ctx.logger;
        this.network = ctx.network;
        this.blockchain = ctx.blockchain;
        this.graphStorage = ctx.graphStorage;
        this.notifyError = ctx.notifyError;
    }

    async startChallenging() {
        // TODO: temp solution to delay.
        // Should be started after replication-finished received.
        setTimeout(() => {
            setInterval(this.intervalFunc, intervalMs, this, this.network, this.log);
        }, 30000);
        this.log.info(`Started challenging timer at ${intervalMs}ms.`);
    }

    stopChallenging() {
        if (this.timerId !== undefined) {
            clearTimeout(this.timerId);
            this.timerId = undefined;
            this.log.info('stopped challenging timer.');
        }
    }

    /**
     * Handles litigation for DH failed test
     * @return {Promise<void>}
     */
    async initiateLitigation(challenge) {
        const contact = await this.network.kademlia().getContact(challenge.dh_id);

        const dhId = challenge.dh_id;
        const dhWallet = contact.wallet;
        const blockId = challenge.block_id;
        const importId = challenge.import_id;

        const replicatedData = await Models.replicated_data.findOne({
            where: { dh_id: dhId, import_id: importId },
        });

        const vertices = await this.graphStorage.findVerticesByImportId(importId);
        Graph.encryptVertices(vertices, replicatedData.data_private_key);

        ImportUtilities.sort(vertices);
        const litigationBlocks = Challenge.getBlocks(vertices, 32);
        const litigationBlocksMerkleTree = new MerkleTree(litigationBlocks);
        const merkleProof = litigationBlocksMerkleTree.createProof(blockId);

        try {
            await this.blockchain.initiateLitigation(importId, dhWallet, blockId, merkleProof);
        } catch (e) {
            this.log.error(`Failed to initiate litigation. ${e}`);
            this.notifyError(e);
            return;
        }

        const waitForLitigation = 15 * 60 * 1000;
        await this.blockchain.subscribeToEvent('LitigationAnswered', importId, waitForLitigation);

        const block = litigationBlocks[blockId];
        this.log.debug(`Sending proof for litigation, Import ${importId}. Answer for block ${blockId} is ${block}`);
        await this.blockchain.proveLitigation(importId, dhWallet, block);

        const waitForLitigationEnd = 15 * 60 * 1000;
        const eventData = await this.blockchain.subscribeToEvent('LitigationCompleted', importId, waitForLitigationEnd);
        const {
            DH_wallet,
            DH_was_penalized,
        } = eventData;

        if (dhWallet === DH_wallet) {
            if (DH_was_penalized) {
                replicatedData.status = 'FAILED';
                // TODO delete challenges
            } else {
                replicatedData.status = 'ACTIVE';
            }
        }
        await replicatedData.save({ fields: ['status'] });
    }

    async sendChallenge(challenge, challenger, network, log) {
        if (challenge.sent) {
            return;
        }
        const replicatedData = await Models.replicated_data.findOne({
            where: { dh_id: challenge.dh_id, import_id: challenge.import_id },
        });

        if (replicatedData.status === 'ACTIVE') {
            log.trace(`Sending challenge to ${challenge.dh_id}. Import ID ${challenge.import_id}, block ID ${challenge.block_id}.`);

            const payload = {
                payload: {
                    block_id: challenge.block_id,
                    import_id: challenge.import_id,
                },
            };

            challenge.sent = true;
            await challenge.save({ fields: ['sent'] });
            await network.kademlia().challengeRequest(
                payload, challenge.dh_id,
                async (error, response) => {
                    if (error) {
                        log.warn(`failed to get challenge answer from ${challenge.dh_id}. ${error}.`);
                        return;
                    }

                    if (typeof response.status === 'undefined') {
                        log.warn('challenge-request: Missing status');
                        return;
                    }

                    if (response.status !== 'success') {
                        log.trace('challenge-request: Response not successful.');
                    }

                    if (response.answer === challenge.answer) {
                        log.trace('Successfully answered to challenge.');

                        replicatedData.status = 'ACTIVE';
                        replicatedData.save({ fields: ['status'] });

                        await Challenge.completeTest(challenge.id);
                    } else {
                        log.info(`Wrong answer to challenge '${response.answer} for DH ID ${challenge.dh_id}.'`);
                        // TODO doktor: Handle promise.
                        await Challenge.failTest(challenge.id);

                        replicatedData.status = 'LITIGATION';
                        await replicatedData.save({ fields: ['status'] });

                        await challenger.initiateLitigation(challenge);
                    }
                },
            );
        }
    }

    intervalFunc(challenger, network, log) {
        const time_now = Date.now();
        Challenge.getUnansweredTest(time_now - intervalMs, time_now + intervalMs)
            .then(async (challenges) => {
                if (challenges.length > 0) {
                    for (const challenge of challenges) {
                        // eslint-disable-next-line
                        await challenger.sendChallenge(challenge, challenger, network, log);
                    }
                } else {
                    //  log.trace('No challenges found.');
                }
            }).catch((err) => {
                log.error(`Failed to get unanswered challenges. Error: ${err}.`);
                this.notifyError(err);
            });
    }
}

module.exports = Challenger;
