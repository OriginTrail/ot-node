const fs = require('fs');
const { execSync, spawn } = require('child_process');
const assert = require('assert');
const mkdirp = require('mkdirp');
const path = require('path');
const EventEmitter = require('events');
const deepExtend = require('deep-extend');
const tmpdir = require('os').tmpdir();
const uuidv4 = require('uuid/v4');
const stripAnsi = require('strip-ansi');
const lineReader = require('readline');

const defaultConfiguration = require('../../../../config/config.json').development;


const uuidRegex = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const walletRegex = /\b0x[0-9A-F]{40}\b/gi;
const identityRegex = /\b[0-9A-F]{40}\b/gi;
const offerIdRegex = /\b0x[0-9A-F]{64}\b/gi;
const dataSetRegex = /\b0x[0-9A-F]{64}\b/gi;

/**
 * OtNode represent small wrapper over a running OT Node.
 *
 * One instance of OtNode class handles one running node.
 */
class OtNode extends EventEmitter {
    constructor({ logger, nodeConfiguration }) {
        super();

        this.id = uuidv4();
        this.options = {};
        this.options.configDir = path.join(tmpdir, this.id);
        this.options.nodeConfiguration = nodeConfiguration || {};
        this.options.nodeConfiguration = deepExtend(
            Object.assign({}, defaultConfiguration), // deepExtend changes original object.
            this.options.nodeConfiguration,
        );
        this.logger = logger || console;

        this.initialized = false;
        this.started = false;
    }

    initialize() {
        mkdirp.sync(this.options.configDir);
        this.configFilePath = path.join(this.options.configDir, 'initial-configuration.json');
        fs.writeFileSync(
            this.configFilePath,
            JSON.stringify(this.options.nodeConfiguration, null, 4),
        );
        execSync(`npm run setup -- --configDir=${this.options.configDir} --config ${this.configFilePath}`);

        if (this.options.identity) {
            fs.writeFileSync(
                path.join(this.options.configDir, 'identity.json'),
                JSON.stringify(this.options.identity),
            );
        }

        this.state = {};
        this.state.addedBids = []; // List of offer IDs (DH side).
        this.state.takenBids = []; // List of offer IDs (DH side).
        // Valid replications (DH side). List of internal offer IDs and their replications DH IDs
        // in pairs. { internalOfferId, dhId }.
        this.state.replications = [];
        // Valid replications (DC side). List of objects { importId, dhWallet }.
        this.state.holdingData = [];
        // Offers finalized. List of offer IDs.
        this.state.offersFinalized = [];
        // grab node's wallet address
        this.state.nodesWalletAddress = null;

        // Dict of offers created:
        // { offerIDs: { id: { dataSetId, internalID },
        //  internalIDs: { id: { dataSetId, offerID } } }
        this.state.offers = {};

        // Temp solution until node.log is moved to the configDir.
        this.logStream = fs.createWriteStream(path.join(this.options.configDir, 'node-cucumber.log'));

        this.logger.log(`Node initialized at: '${this.options.configDir}'.`);
        this.initialized = true;
    }

    start() {
        assert(!this.process);
        assert(this.initialized);
        assert(!this.stared);
        this.logger.log(`Starting node ${this.id}.`);
        // Starting node should be done with following code:
        // this.process = spawn('npm', ['start', '--', `--configDir=${this.options.configDir}`]);
        // The problem is with it spawns two child process thus creating the problem when
        // sending the SIGINT in order to close it.
        // Enable debug here process.env.NODE_DEBUG = 'https';
        this.process = spawn(
            'node',
            ['ot-node.js', `--configDir=${this.options.configDir}`, '--config', `${this.configFilePath}`],
            { cwd: path.join(__dirname, '../../../../') },
        );
        this.process.on('close', code => this._processExited(code));
        this.process.stdout.on('data', data => this.logStream.write(data));
        this.process.stderr.on('data', data => this.logStream.write(data));

        this.lineReaderStdOut = lineReader.createInterface({
            input: this.process.stdout,
        });
        this.lineReaderStdOut.on('line', data => this._processOutput(data));
        this.lineReaderStdErr = lineReader.createInterface({
            input: this.process.stderr,
        });
        this.lineReaderStdErr.on('line', data => this._processOutput(data));
        this.logger.log(`Node '${this.id}' has been started.`);
        this.started = true;
    }

    stop() {
        this.logger.log(`Stopping node ${this.id}.`);
        assert(this.isRunning);
        this.process.kill('SIGINT');
    }

    _processOutput(data) {
        let line = stripAnsi(data.toString());
        line = line.replace(/[^\x20-\x7E]+/g, '');

        if (line.includes('OT Node started')) {
            this.logger.log(`Node ${this.id} initialized.`);
            this.state.initialized = true;
            this.emit('initialized');
        } else if (line.includes('My network identity: ')) {
            // Expected something like:
            // 'My network identity: f299588d23ebbdc2da51ad423e03d66721ac0e18'
            [this.state.identity] = line.match(identityRegex);
            // OT Node listening at https://f63f6c1e9425e79726e26cff0808659ddd16b417.diglet.origintrail.io:443
        } else if (line.includes('API exposed at')) {
            // Expected something like:
            // API exposed at  http://0.0.0.0:8920
            // TODO: Poor man's parsing. Use regular expressions.
            this.state.node_rpc_url = line.substr(line.search('API exposed at  ') + 'API exposed at  '.length, line.length - 1);
        } else if (line.includes('OT Node listening at ')) {
            // Expected something like:
            // OT Node listening at https://f63f6c1e9425e79726e26cff0808659ddd16b417.diglet.origintrail.io:443
            // TODO: Poor man's parsing. Use regular expressions.
            this.state.node_url = line.substr(line.search('OT Node listening at ') + 'OT Node listening at '.length, line.length - 1);
        } else if (line.match(/[DH] Replication finished for offer ID .+/gi)) {
            const offerId = line.match(offerIdRegex)[0];
            assert(offerId);
            this.state.addedBids.push(offerId);
            this.emit('replication-finished', offerId);
        } else if (line.match(/I've been chosen for offer .+\./gi)) {
            const offerId = line.match(offerIdRegex)[0];
            this.state.takenBids.push(offerId);
        } else if (line.match(/Replication for offer ID .+ sent to .+/gi)) {
            const internalOfferId = line.match(uuidRegex)[0];
            const dhId = line.match(identityRegex)[0];
            assert(internalOfferId);
            assert(dhId);
            this.state.replications.push({ internalOfferId, dhId });
            this.emit('dh-replicated', { internalOfferId, dhId });
        } else if (line.includes('Get profile by wallet ')) {
            // note that node's wallet can also be access via nodeConfiguration directly
            const wallet = line.match(walletRegex)[0];
            assert(wallet);
            this.state.nodesWalletAddress = wallet;
        } else if (line.match(/Offer successfully started for data set .+\. Offer ID .+\. Internal offer ID .+\./gi)) {
            const dataSetId = line.match(dataSetRegex)[0];
            const offerId = line.match(offerIdRegex)[1];
            const internalOfferId = line.match(uuidRegex)[0];
            assert(dataSetId);
            assert(offerId);
            assert(internalOfferId);

            deepExtend(this.state.offers, {
                offerIDs: { [offerId]: { dataSetId, internalOfferId } },
                internalIDs: { [internalOfferId]: { dataSetId, offerId } },
            });
        } else if (line.match(/Miner started for offer .+\./gi)) {
            const offerId = line.match(offerIdRegex)[0];
        } else if (line.match(/Miner found a solution of offer .+\./gi)) {
            const offerId = line.match(offerIdRegex)[0];
        } else if (line.match(/Offer .+ finalized/gi)) {
            const offerId = line.match(offerIdRegex)[0];
            assert(offerId);
            this.state.offersFinalized.push(offerId);
            this.emit('offer-finalized', offerId);
        } else if (line.match(/Command dvHandleNetworkQueryResponsesCommand and ID .+ processed/gi)) {
            console.log('dv-network-query-processed emitted');
            this.emit('dv-network-query-processed');
        }
    }

    get isRunning() {
        return this.initialized && this.started && !!this.process;
    }

    _processExited(code) {
        if (code !== 0) {
            throw Error(`Node '${this.options.configDir}' exited with ${code}.`);
        }
        this.process = null;
        this.logStream.end();
        this.logger.log(`Node ${this.id} finished. Exit code ${code}.`);
        this.emit('finished', code);
    }
}

module.exports = OtNode;
