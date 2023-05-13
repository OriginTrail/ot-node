/* eslint-disable import/no-unresolved */
import appRootPath from 'app-root-path';
import { join } from 'path';
import { createFromPrivKey, createRSAPeerId } from '@libp2p/peer-id-factory';
import { keys } from '@libp2p/crypto';
import { fromString as uint8ArrayFromString, toString as uint8ArrayToString } from 'uint8arrays';
import { mkdir, writeFile, readFile, stat } from 'fs/promises';
import {
    LIBP2P_KEY_DIRECTORY,
    LIBP2P_KEY_FILENAME,
    NODE_ENVIRONMENTS,
} from '../../../constants/constants.js';

const devEnvironment =
    process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
    process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST;

class KeyManager {
    constructor(config) {
        this.config = config;
    }

    async getPeerId() {
        let { privateKey } = this.config;
        let peerId = null;

        if (!devEnvironment || !privateKey) {
            privateKey = await this.readPrivateKeyFromFile();
        }

        if (!privateKey) {
            peerId = await createRSAPeerId({ bits: 1024 });
            privateKey = uint8ArrayToString(peerId.privateKey, 'base64pad');
            await this.savePrivateKeyInFile(privateKey);
        } else {
            peerId = await createFromPrivKey(
                await keys.unmarshalPrivateKey(uint8ArrayFromString(privateKey, 'base64pad')),
            );
        }

        return peerId;
    }

    async savePrivateKeyInFile(privateKey) {
        const { fullPath, directoryPath } = this.getKeyPath();
        await mkdir(directoryPath, { recursive: true });
        await writeFile(fullPath, privateKey);
    }

    getKeyPath() {
        let directoryPath;
        if (!devEnvironment) {
            directoryPath = join(
                appRootPath.path,
                '..',
                this.config.appDataPath,
                LIBP2P_KEY_DIRECTORY,
            );
        } else {
            directoryPath = join(appRootPath.path, this.config.appDataPath, LIBP2P_KEY_DIRECTORY);
        }

        const fullPath = join(directoryPath, LIBP2P_KEY_FILENAME);
        return { fullPath, directoryPath };
    }

    async readPrivateKeyFromFile() {
        const keyPath = this.getKeyPath();
        if (await this.fileExists(keyPath.fullPath)) {
            const key = (await readFile(keyPath.fullPath)).toString();
            return key;
        }
    }

    async fileExists(filePath) {
        try {
            await stat(filePath);
            return true;
        } catch (e) {
            return false;
        }
    }
}

export default KeyManager;
