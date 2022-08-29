/* eslint no-console: 0 */
import 'dotenv/config';
import ms from 'ms';
import DeepExtend from 'deep-extend';
import rc from 'rc';
import fs from 'fs-extra';
import { v4 as uuid } from 'uuid';
import Logger from '../src/logger/logger';
import configjson from '../config/config.json';
import pjson from '../package.json' assert { type: 'json' };
import RepositoryModuleManager from '../src/modules/repository/repository-module-manager';
import jwtUtil from '../src/service/util/jwt-util';

const getLogger = () => new Logger('silent', false);
let repository;

const getConfig = () => {
    let config;
    let userConfig;

    if (process.env.USER_CONFIG_PATH) {
        const configurationFilename = process.env.USER_CONFIG_PATH;
        const pathSplit = configurationFilename.split('/');
        userConfig = JSON.parse(fs.readFileSync(configurationFilename));
        userConfig.configFilename = pathSplit[pathSplit.length - 1];
    }

    const defaultConfig = JSON.parse(JSON.stringify(configjson[process.env.NODE_ENV]));

    if (userConfig) {
        config = DeepExtend(defaultConfig, userConfig);
    } else {
        config = rc(pjson.name, defaultConfig);
    }

    if (!config.configFilename) {
        // set default user configuration filename
        config.configFilename = '.origintrail_noderc';
    }
    return config;
};

const loadRepository = async () => {
    repository = new RepositoryModuleManager({ logger: getLogger(), config: getConfig() });
    await repository.initialize();
};

/**
 * Returns argument from argv
 * @param argName
 * @returns {string|null}
 */
const getArg = (argName) => {
    const args = process.argv;
    const arg = args.find((a) => a.startsWith(argName));

    if (!arg) {
        return null;
    }

    const argSplit = arg.split('=');

    if (!arg || argSplit.length < 2 || !argSplit[1]) {
        return null;
    }

    return argSplit[1];
};
/**
 * Returns user's name from arguments
 * @returns {string}
 */
const getUserFromArgs = () => {
    const arg = getArg('--user');

    if (!arg) {
        return 'node-runner';
    }

    return arg;
};

/**
 * Returns expiresAt from arguments
 * If no expiresAt is provided, null is returned
 * Expressed in seconds or a string describing a time span zeit/ms
 * @returns {string|null}
 */
const getExpiresInArg = () => {
    const arg = getArg('--expiresIn');

    if (!arg) {
        return null;
    }

    if (!ms(arg)) {
        console.log('\x1b[31m[ERROR]\x1b[0m Invalid value for expiresIn argument');
        process.exit(1);
    }

    return arg;
};

/**
 * Returns expiresAt from arguments
 * If no expiresAt is provided, null is returned
 * Expressed in seconds or a string describing a time span zeit/ms
 * @returns {string|null}
 */
const getTokenName = () => {
    const arg = getArg('--tokenName');

    if (!arg) {
        console.log('\x1b[31m[ERROR]\x1b[0m Missing mandatory tokenName argument.');
        process.exit(1);
    }

    return arg;
};

const saveTokenData = async (tokenId, userId, tokenName, expiresIn) => {
    let expiresAt = null;

    if (expiresIn) {
        const time = new Date().getTime() + ms(expiresIn);
        expiresAt = new Date(time);
    }

    await repository.saveToken(tokenId, userId, tokenName, expiresAt);
};

const printMessage = (token, hasExpiryDate) => {
    console.log('\x1b[32mAccess token successfully created.\x1b[0m ');

    if (!hasExpiryDate) {
        console.log('\x1b[33m[WARNING] Created token has no expiry date. \x1b[0m ');
    }

    console.log(token);
    console.log(
        '\x1b[32mMake sure to copy your personal access token now. You won’t be able to see it again!\x1b[0m ',
    );
};

const getUserId = async (username) => {
    const user = await repository.getUser(username);

    if (!user) {
        console.log(`\x1b[31m[ERROR]\x1b[0m User ${username} doesn't exist.`);
        process.exit(1);
    }

    return user.id;
};

const generateToken = async () => {
    const username = getUserFromArgs();
    const expiresIn = getExpiresInArg();
    const tokenName = getTokenName();

    await loadRepository();

    const userId = await getUserId(username);
    const tokenId = uuid();

    await saveTokenData(tokenId, userId, tokenName, expiresIn);

    const token = jwtUtil.generateJWT(tokenId, expiresIn);

    printMessage(token, expiresIn);
    process.exit(0);
};

generateToken();
