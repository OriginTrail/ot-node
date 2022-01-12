const {execSync} = require('child_process');
const Command = require('../command');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const converter = require('json-2-csv');
const split = require('split');
const {finished} = require('stream');
// Constructing promisify from util
const {promisify} = require('util');
const path = require("path");
// Defining finishedAsync method
const finishedAsync = promisify(finished);

class SendTelemetryCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.publishService = ctx.publishService;
        this.telemetryHubModuleManager = ctx.telemetryHubModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        if (!this.config.telemetryHub.enabled) {
            return Command.empty();
        }

        this.telemetryHubModuleManager.aggregateTelemetryData()
            .then(jsonld =>
            {
                if (jsonld)
                    this.publishService.publish(JSON.stringify(jsonld), '.json', [], [`ot-telemetry-${Math.floor(new Date() / (60 * 1000))}`], true, null)
            })
            .catch(e=>this.logger.error(e.message));

        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'sendTelemetryCommand',
            delay: 0,
            data: {
                message: '',
            },
            period: 1 * 60 * 1000, // 5 * 60 * 1000
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = SendTelemetryCommand;
