const Bugsnag = require('@bugsnag/js');
const pjson = require('../../package.json');
const constants = require('../constants');

class ErrorNotificationService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.profileService = ctx.profileService;
        this.blockchain = ctx.blockchain;
    }

    initialize() {
        const cleanConfig = Object.assign({}, this.config);
        delete cleanConfig.node_private_key;
        delete cleanConfig.houston_password;
        delete cleanConfig.database;
        delete cleanConfig.blockchain;

        const releaseStage = process.env.NODE_ENV === 'mariner' ? 'mainnet' : process.env.NODE_ENV;

        const { node_wallet, management_wallet } = this.blockchain.getWallet('ethr');

        // todo pass blockchain identity
        Bugsnag.start({
            apiKey: pjson.config.bugsnagkey,
            appVersion: pjson.version,
            hostname: this.config.network.hostname,
            severity: 'error',
            // bugsnag automatically reads release stage from process.env.NODE_ENV
            enabledReleaseStages: ['testnet', 'mainnet', 'mariner'],
            releaseStage,
            logger: this.logger,
            // uncaught exceptions and unhandeld rejections are automatically handled
            autoDetectErrors: true,
            /* user can have only id, name and email fields
              TODO Think about adding this data to configuration for each user
               as user provided data so it can help us with debugging
            * */
            user: {
                id: this.profileService.getIdentity(),
                name: '',
                email: '',
            },
            // metadata top level keys  are section names that are
            // displayed as tabs in the Bugsnag dashboard.

            metadata: {
                generalNodeInformation: {
                    nodeId: this.config.identity,
                    managementWallet: management_wallet,
                    operationalWallet: node_wallet,
                },
                configuration: cleanConfig,
            },
        });
    }

    /**
     * Sends event with error severity to bugsnag
     * @param error - error object
     * @param options - add aditional data for error
     * @param process - add process that error is connected to (litigation, import, export)
     */
    notifyError(error, options = null, process = constants.PROCESS_NAME.other) {
        Bugsnag.notify(error, (event) => {
            event.app.type = process;
            if (options) {
                event.addMetadata(process, options);
            }
        });
    }

    /**
     * Sends event with warning severity to bugsnag
     * @param message - warning message
     * @param options - add aditional data for error
     * @param process - add process that error is connected to (litigation, import, export)
     */
    notifyWarning(message, options = null, process = constants.PROCESS_NAME.other) {
        Bugsnag.notify(new Error(message), (event) => {
            event.severity = 'warning';
            event.app.type = process;
            if (options) {
                event.addMetadata(process, options);
            }
        });
    }

    /**
     * Sends event with info severity to bugsnag
     * @param message - info message
     * @param options - add aditional data for error
     * @param process - add process that error is connected to (litigation, import, export)
     */
    notifyInfo(message, options = null, process = constants.PROCESS_NAME.other) {
        Bugsnag.notify(new Error(message), (event) => {
            event.severity = 'info';
            event.app.type = process;
            if (options) {
                event.addMetadata(process, options);
            }
        });
    }
}

module.exports = ErrorNotificationService;
