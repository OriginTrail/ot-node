import { spawn } from 'child_process';
import { BLS_KEY_FILENAME, NODE_ENVIRONMENTS } from '../constants/constants.js';

class BLSService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.fileService = ctx.fileService;
        this.binaryPath = this.fileService.getBinaryPath('bls-tools');
    }

    async initialize() {
        if (!this.config.blsPublicKey) {
            const devEnvironment =
                process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
                process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST;

            if (!devEnvironment || !this.config.blsSecretKey) {
                this.config.blsSecretKey = await this.readSecretKeyFromFile();
            }

            if (!this.config.blsSecretKey) {
                const keys = await this.generateKeys();
                this.config.blsPublicKey = keys.publicKey;
                this.config.blsSecretKey = keys.secretKey;
                await this.fileService.writeContentsToFile(
                    this.fileService.getBLSSecretKeyFolderPath(),
                    BLS_KEY_FILENAME,
                    this.config.blsSecretKey,
                    false,
                );
            } else {
                this.config.blsPublicKey = await this.publicKeyFromSecret();
            }
        }

        this.logger.info(`BLS Public Key is ${this.config.blsPublicKey}`);
    }

    async readSecretKeyFromFile() {
        const secretKeyPath = this.fileService.getBLSSecretKeyPath();
        const secretKeyFileExists = await this.fileService.pathExists(secretKeyPath);
        if (secretKeyFileExists) {
            return this.fileService.readFile(secretKeyPath);
        }
    }

    async runBLSBinary(args, jsonOutput = false) {
        return new Promise((resolve) => {
            const process = spawn(this.binaryPath, args);
            let result = '';
            process.stdout.on('data', (data) => {
                result += data.toString();
            });
            process.stderr.on('data', (data) => {
                this.logger.error(`Error: ${data}`);
            });
            process.on('close', () => {
                if (jsonOutput) {
                    resolve(JSON.parse(result));
                } else {
                    resolve(result.trim());
                }
            });
        });
    }

    async generateKeys() {
        return this.runBLSBinary(['generate-keys'], true);
    }

    async publicKeyFromSecret() {
        return this.runBLSBinary(['public-key-from-secret', '--secret', this.config.blsSecretKey]);
    }

    async sign(message) {
        return this.runBLSBinary([
            'sign',
            '--secret',
            this.config.blsSecretKey,
            '--message',
            message,
        ]);
    }
}

export default BLSService;
