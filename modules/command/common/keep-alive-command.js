const { v1: uuidv1 } = require('uuid');
const axios = require('axios');
const Command = require('../command');
const pjson = require('../../../package.json');
const Models = require('../../../models/index');
const constants = require('../../constants');

class KeepAliveCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { message } = command.data;

        const Id_operation = uuidv1();
        this.logger.emit({
            msg: message,
            Event_name: 'keep_alive',
            Operation_name: 'KeepAlive',
            Id_operation,
        });

        const signalingMessage = {
            nodeVersion: pjson.version,
            autoUpdate: { enabled: this.config.modules.autoUpdater.enabled },
            telemetry: {
                enabled: this.config.telemetryHub.enabled,
            },
        };
        try {
            signalingMessage.issuerWallet = this.config.modules.blockchain.implementation['web3-service'].config.publicKey;
            signalingMessage.kademliaNodeId = this.config.network.peerId._idB58String;
            signalingMessage.nodeVersion = pjson.version;
            signalingMessage.telemetry.latestAssertions = (
                await Models.assertions.findAll({
                    limit: 5,
                    order: [['created_at', 'DESC']],
                    attributes: ['hash', 'topics', 'created_at', 'triple_store', 'status'],
                })
            ).map((x) => ({
                assertionId: x.dataValues.hash,
                keyword: x.dataValues.topics,
                publishTimestamp: x.dataValues.created_at,
                tripleStore: x.dataValues.triple_store,
                status: x.dataValues.status,
            }));
        } catch (e) {
            this.logger.error({
                msg: `An error has occurred with signaling data error: ${e}, stack: ${e.stack}`,
                Event_name: constants.ERROR_TYPE.KEEP_ALIVE_ERROR,
            });
        }

        const proof = {};
        proof.hash = this.validationModuleManager.calculateHash(signalingMessage);
        proof.signature = this.validationModuleManager.sign(proof.hash, this.blockchainModuleManager.getPrivateKey());

        signalingMessage.proof = proof;

        const config = {
            method: 'post',
            url: 'https://signum.origintrail.io:3000/signal',
            headers: {
                'Content-Type': 'application/json',
            },
            data: JSON.stringify(signalingMessage),
        };

        const that = this;
        axios(config).catch((e) => {
            that.handleError(uuidv1(), e, constants.ERROR_TYPE.KEEP_ALIVE_ERROR, false);
        });
        return Command.repeat();
    }

    /**
     * Builds default dcConvertToOtJsonCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'keepAliveCommand',
            delay: 0,
            data: {
                message: 'OT-Node is alive...',
            },
            period: 15 * 60 * 1000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = KeepAliveCommand;
