import { Given } from '@cucumber/cucumber';
import { expect, assert } from 'chai';
import DkgClientHelper from '../../utilities/dkg-client-helper.mjs';
import DeepExtend from "deep-extend";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const defaultConfiguration = require('./config/origintrail-test-node-config.json');
const bootstrapNodeConfiguration = require('./config/origintrail-test-bootstrap-config.json');
import {createNodeConfiguration, forkNode} from "../../utilities/steps-utils.mjs";
import fs from "fs";

Given(
    /^I setup (\d+)[ additional]* node[s]*$/,
    { timeout: 80000 },
    function nodeSetup(nodeCount, done) {
        this.logger.log(`I setup ${nodeCount} node${nodeCount !== 1 ? 's' : ''}`);
        const wallets = this.state.localBlockchain.getWallets();
        const currentNumberOfNodes = Object.keys(this.state.nodes).length;
        let nodesStarted = 0;
        for (let i = 0; i < nodeCount; i += 1) {
            const nodeIndex = currentNumberOfNodes + i;
            const wallet = wallets[nodeIndex + 1];
            const managementWallet = wallets[nodeIndex + 1 + Math.floor(wallets.length / 2)];
            const rpcPort = 8901 + nodeIndex;
            const nodeName = `origintrail-test-${nodeIndex}`;
            const nodeConfiguration = DeepExtend(
                {},
                defaultConfiguration,
                createNodeConfiguration.call(
                    this,
                    wallet,
                    managementWallet,
                    nodeIndex,
                    nodeName,
                    rpcPort,
                ),
            );
            const forkedNode = forkNode(nodeConfiguration);
            const logFileStream = fs.createWriteStream(
                `${this.state.scenarionLogDir}/${nodeName}.log`,
            );
            forkedNode.stdout.setEncoding('utf8');
            forkedNode.stdout.on('data', (data) => {
                // Here is where the output goes
                logFileStream.write(data);
            });
            // eslint-disable-next-line no-loop-func
            forkedNode.on('message', (response) => {
                if (response.error) {
                    assert.fail(
                        `Error while trying initialize node${nodeIndex} client: ${response.error}`,
                    );
                } else {
                    // todo if started
                    const client = new DkgClientHelper({
                        endpoint: 'http://localhost',
                        port: rpcPort,
                        useSSL: false,
                        timeout: 25,
                        loglevel: 'trace',
                    });
                    this.state.nodes[nodeIndex] = {
                        client,
                        forkedNode,
                        configuration: nodeConfiguration,
                        nodeRpcUrl: `http://localhost:${rpcPort}`,
                    };
                }
                nodesStarted += 1;
                if (nodesStarted === nodeCount) {
                    done();
                }
            });
        }
    },
);

Given(
    /^(\d+) bootstrap is running$/,
    { timeout: 60000 },
    function bootstrapRunning(nodeCount, done) {
        expect(this.state.bootstraps).to.have.length(0);
        expect(nodeCount).to.be.equal(1); // Currently not supported more.
        this.logger.log('Initializing bootstrap node');
        const nodeName = 'origintrail-test-bootstrap';
        const forkedNode = forkNode(bootstrapNodeConfiguration);

        const logFileStream = fs.createWriteStream(`${this.state.scenarionLogDir}/${nodeName}.log`);
        forkedNode.stdout.setEncoding('utf8');
        forkedNode.stdout.on('data', (data) => {
            // Here is where the output goes
            logFileStream.write(data);
        });
        forkedNode.on('message', async (response) => {
            if (response.error) {
                // todo handle error
            } else {
                // todo if started
                const client = new DkgClientHelper({
                    endpoint: 'http://localhost',
                    port: 8900,
                    useSSL: false,
                    timeout: 25,
                    loglevel: 'trace',
                });
                this.state.bootstraps.push({
                    client,
                    forkedNode,
                    configuration: bootstrapNodeConfiguration,
                    nodeRpcUrl: `http://localhost:${bootstrapNodeConfiguration.rpcPort}`,
                });
            }
            done();
        });
    },
);
// TODO: Implement input error handling
Given(
    'I setup node {int} with {word} set to {string}',
    { timeout: 120000 },
    function setupPublishNode(nodeNum, propertyName, propertyValue, done) {
        const propertyNameSplit = propertyName.split('.');
        this.logger.log(`I setup node ${nodeNum} with invalid configuration`);
        expect(
            Object.prototype.hasOwnProperty.call(defaultConfiguration, propertyNameSplit[0]),
            `Property ${propertyName} doesn't exist`,
        ).to.be.equal(true);
        const nodeIndex = Object.keys(this.state.nodes).length;
        const wallets = this.state.localBlockchain.getWallets();
        const wallet = wallets[nodeIndex + 1];
        const managementWallet =
            this.state.localBlockchain.getWallets()[nodeIndex + 1 + Math.floor(wallets.length / 2)];
        const rpcPort = 8901 + nodeIndex;
        const nodeName = `origintrail-test-${nodeIndex}`;
        const nodeConfiguration = DeepExtend(
            {},
            defaultConfiguration,
            createNodeConfiguration.call(
                this,
                wallet,
                managementWallet,
                nodeIndex,
                nodeName,
                rpcPort,
            ),
        );
        const propertyNameSplitLen = propertyNameSplit.length;
        let propName = nodeConfiguration;
        for (let i = 0; i < propertyNameSplitLen - 1; i += 1) {
            propName = propName[propertyNameSplit[i]];
        }
        // TODO: ugly workaround, change it
        propName[propertyNameSplit.slice(-1)] = propertyValue === '\\0' ? '\0' : propertyValue;
        const forkedNode = forkNode(nodeConfiguration);

        const logFileStream = fs.createWriteStream(`${this.state.scenarionLogDir}/${nodeName}.log`);
        forkedNode.stdout.setEncoding('utf8');
        forkedNode.stdout.on('data', (data) => {
            // Here is where the output goes
            logFileStream.write(data);
        });

        // eslint-disable-next-line no-loop-func
        forkedNode.on('message', (response) => {
            if (response.error) {
                assert.fail(
                    `Error while trying initialize node${nodeIndex} client: ${response.error}`,
                );
            } else {
                // todo if started
                const client = new DkgClientHelper({
                    endpoint: 'http://localhost',
                    port: rpcPort,
                    useSSL: false,
                    timeout: 25,
                    loglevel: 'trace',
                });
                this.state.nodes[nodeIndex] = {
                    client,
                    clientConfig: {
                        endpoint: 'http://localhost',
                        port: rpcPort,
                        useSSL: false,
                        timeout: 25,
                        loglevel: 'trace',
                    },
                    forkedNode,
                    configuration: nodeConfiguration,
                    nodeRpcUrl: `http://localhost:${rpcPort}`,
                };
            }
            done();
        });
    },
);
Given(
    /Last (GET|PUBLISH) operation finished with status: ([COMPLETED|FAILED|PublishValidateAssertionError|PublishStartError|GetAssertionIdError|GetLocalError|PublishRouteError]+)$/,
    { timeout: 120000 },
    async function lastResolveFinishedCall(operationName, status) {
        this.logger.log(`Last ${operationName} operation finished with status: ${status}`);
        const operationData = operationName === 'GET' ? 'lastResolveData' : 'lastPublishData';
        expect(
            !!this.state[operationData],
            `Last ${operationName} result is undefined. ${operationName} result not started.`,
        ).to.be.equal(true);
        expect(
            !!this.state[operationData].result,
            `Last ${operationName} result data result is undefined. ${operationName} result is not finished.`,
        ).to.be.equal(true);

        expect(
            this.state[operationData].errorType ?? this.state[operationData].status,
            `${operationName} result status validation failed`,
        ).to.be.equal(status);
    },
);

