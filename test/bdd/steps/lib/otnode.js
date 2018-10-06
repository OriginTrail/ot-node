const fs = require('fs');
const { execSync, spawn } = require('child_process');
const assert = require('assert');
const mkdirp = require('mkdirp');
const path = require('path');
const EventEmitter = require('events');
const deepExtend = require('deep-extend');
const tmpdir = require('os').tmpdir();
const uuidv4 = require('uuid/v4');

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
        this.state.initialized = false;

        // Temp solution until node.log is moved to the configDir.
        this.logStream = fs.createWriteStream(path.join(this.options.configDir, 'node-cucumber.log'));

        this.logger.log(`Node created at: '${this.options.configDir}'.`);
        this.initialized = true;
    }

    start() {
        assert(!this.process);
        this.logger.log(`Starting node ${this.id}.`);
        // Starting node should be done with following code:
        // this.process = spawn('npm', ['start', '--', `--configDir=${this.options.configDir}`]);
        // The problem is with it spawns two child process thus creating the problem when
        // sending the SIGINT in order to close it.
        this.process = spawn('node', ['ot-node.js', `--configDir=${this.options.configDir}`], { cwd: '../../' });
        this.process.stdout.on('data', data => this._processOutput(data));
        this.process.stderr.on('data', data => this._processOutput(data));
        this.process.on('close', code => this._processExited(code));
    }

    stop() {
        assert(this.process);
        this.logger.log(`Stopping node ${this.id}.`);
        this.process.kill('SIGINT');
    }

    _processOutput(data) {
        this.logStream.write(data);

        if (data.toString().includes('OT Node started')) {
            this.state.initialized = true;
            this.logger.log(`Node ${this.id} initialized.`);
            this.emit('initialized');
        }
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
