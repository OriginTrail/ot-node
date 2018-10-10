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
    }

    initialize() {
        mkdirp.sync(this.options.configDir);
        execSync(`npm run setup -- --configDir=${this.options.configDir}`);
        fs.writeFileSync(
            path.join(this.options.configDir, 'config.json'),
            JSON.stringify(this.options.nodeConfiguration),
        );

        if (this.options.identity) {
            fs.writeFileSync(
                path.join(this.options.configDir, 'identity.json'),
                JSON.stringify(this.options.identity),
            );
        }

        this.state = {};
        this.state.addedBids = [];
        this.state.notTakenBids = [];

        // Temp solution until node.log is moved to the configDir.
        this.logStream = fs.createWriteStream(path.join(this.options.configDir, 'node-cucumber.log'));

        this.logger.log(`Node created at: '${this.options.configDir}'.`);
        this.initialized = true;
    }

    start() {
        assert(!this.process);
        assert(this.initialized);
        this.logger.log(`Starting node ${this.id}.`);
        // Starting node should be done with following code:
        // this.process = spawn('npm', ['start', '--', `--configDir=${this.options.configDir}`]);
        // The problem is with it spawns two child process thus creating the problem when
        // sending the SIGINT in order to close it.
        this.process = spawn(
            'node',
            ['ot-node.js', `--configDir=${this.options.configDir}`],
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
        } else if (line.includes('My identity: ')) {
            // Expected something like:
            // 'My identity: f299588d23ebbdc2da51ad423e03d66721ac0e18'
            const expression = /\b[0-9A-F]{40}\b/gi;
            [this.state.identity] = line.match(expression);
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
        } else if (line.match(/Bid for .+ successfully added/gi)) {
            this.state.addedBids.push(line.match(/\b0x[0-9A-F]{64}\b/gi)[0]);
        } else if (line.match(/Bid not taken for offer .+\./gi)) {
            this.state.notTakenBids.push(line.match(/\b0x[0-9A-F]{64}\b/gi)[0]);
        } else if (line.match(/Offer for import .+ finalized/gi)) {
            const importId = line.match(/\b0x[0-9A-F]{64}\b/gi)[0];
            this.emit('offer-finalized', importId);
        }
    }

    get isRunning() {
        return this.initialized && !!this.process;
    }

    _processExited(code) {
        assert(code === 0);
        this.process = null;
        this.logStream.end();
        this.logger.log(`Node ${this.id} finished. Exit code ${code}.`);
        this.emit('finished', code);
    }
}

module.exports = OtNode;
