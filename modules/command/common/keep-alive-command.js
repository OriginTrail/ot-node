const { v1: uuidv1 } = require('uuid');
const PeerId = require('peer-id');
var axios = require('axios');
const fs = require('fs');
const Command = require('../command');
const pjson = require('../../../package.json');
const Models = require('../../../models/index');
const constants = require('../../constants');

class KeepAliveCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.validationService = ctx.validationService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { message } = command.data;

        const Id_operation = uuidv1();
        this.logger.emit({
            msg: message, Event_name: 'keep_alive', Operation_name: 'KeepAlive', Id_operation,
        });

        const signalingMessage = {
            nodeVersion: pjson.version,
            autoUpdate: { enabled: this.config.autoUpdate.enabled },
            telemetry: {
                enabled: this.config.telemetryHub.enabled,
            },
        };
        try {
            if (!this.config.network.privateKey) {
                const configFile = JSON.parse(fs.readFileSync(this.config.config ? this.config.config : '.origintrail_noderc'));
                this.config.network.privateKey = configFile.network.privateKey;
            }
            const peerId = await PeerId.createFromPrivKey(this.config.network.privateKey);
            signalingMessage.issuerWallet = this.config.blockchain[0].publicKey;
            signalingMessage.kademliaNodeId = peerId._idB58String;
            signalingMessage.nodeVersion = pjson.version;
            signalingMessage.telemetry.latestAssertions = (await Models.assertions.findAll({
                limit: 5,
                order: [
                    ['created_at', 'DESC'],
                ],
                attributes: ['hash', 'topics', 'created_at'],
            })).map(x => ({assertionId: x.dataValues.hash, keyword: x.dataValues.topics, publishTimestamp: x.dataValues.created_at}));
        } catch (e) {
            this.logger.error({
                msg: `An error has occurred with signaling data error: ${e}, stack: ${e.stack}`,
                Event_name: constants.ERROR_TYPE.KEEP_ALIVE_ERROR,
            });
        }

        const proof = {};
        proof.hash = this.validationService.calculateHash(signalingMessage);
        proof.signature = this.validationService.sign(proof.hash);

        signalingMessage.proof = proof;

        const config = {
            method: 'post',
            url: 'https://signum.origintrail.io:3000/signal',
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(signalingMessage)
        };

        const that = this;
        axios(config).catch(e=>{
            that.handleError(uuidv1(), e, constants.ERROR_TYPE.KEEP_ALIVE_ERROR, false)
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
