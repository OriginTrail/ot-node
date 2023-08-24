import { beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { readFile } from 'fs/promises';
import path from 'path';
import appRootPath from 'app-root-path';
import AutoUpdaterModuleManager from '../../../../src/modules/auto-updater/auto-updater-module-manager.js';
import Logger from '../../../../src/logger/logger.js';
import OTAutoUpdater from '../../../../src/modules/auto-updater/implementation/ot-auto-updater.js';

let autoUpdaterManager;
let otAutoUpdater;

const config = JSON.parse(await readFile('./test/unit/modules/auto-updater/config.json', 'utf-8'));

describe.only('Auto-updater module manager', async () => {
    beforeEach('initialize auto-updater module manager', async () => {
        autoUpdaterManager = new AutoUpdaterModuleManager({
            config,
            logger: new Logger(),
        });

        autoUpdaterManager.initialized = true;

        expect(await autoUpdaterManager.initialize()).to.be.true;
    });

    it('validates module name is as expected', async () => {
        const moduleName = await autoUpdaterManager.getName();

        expect(moduleName).to.equal('autoUpdater');
    });

    it('successful version validation when the module is initialized', async () => {
        const { upToDate, currentVersion } = await autoUpdaterManager.compareVersions();

        expect(await autoUpdaterManager.compareVersions()).to.be.a('object').and.not.be.empty;
        expect(upToDate).to.be.true;
        expect(currentVersion).not.to.be.null;
    });

    it('failed version validation when the module is initialized', async () => {
        autoUpdaterManager.initialized = false;

        try {
            await autoUpdaterManager.compareVersions();
        } catch (error) {
            expect(error.message).to.equal('Auto updater module is not initialized.');
        }
    });

    it('Comparing versions mismatch when the module is initialized', async () => {
        // otAutoUpdater = new OTAutoUpdater();
        // otAutoUpdater.initialized = true;
        //
        // // eslint-disable-next-line no-multi-assign
        // const newRemoteVersion = autoUpdaterManager.readRemoteVersion = () => Promise.resolve('6.0.14');
        // const remoteVersion = await newRemoteVersion();
    });

    it.only('successful update', async (done) => {
        otAutoUpdater = new OTAutoUpdater();
        otAutoUpdater.initialized = true;

        const rootPath = path.join(appRootPath.path, '..');
        // eslint-disable-next-line no-multi-assign
        otAutoUpdater.readRemoteVersion = () => Promise.resolve('6.0.14');
        const { currentVersion } = await autoUpdaterManager.compareVersions();
        const currentDirectory = appRootPath.path;
        const updateDirectory = path.join(rootPath, '6.0.14');
        const zipArchiveDestination = `${updateDirectory}.zip`;
        const tmpExtractionPath = path.join(rootPath, 'TmpExtractionPath');

        otAutoUpdater.downloadUpdate = (destination) => {
            if (!destination) {
                throw new Error('The destination is not defined');
            }
            return Promise.resolve();
        };

        await otAutoUpdater.downloadUpdate(zipArchiveDestination);

        otAutoUpdater.unzipFile = (destination, source) => {
            if (!destination && !source) {
                throw new Error('The destination and source are not defined');
            }
            return Promise.resolve();
        };
        await otAutoUpdater.unzipFile(tmpExtractionPath, zipArchiveDestination);

        otAutoUpdater.moveAndCleanExtractedData = (extractedDataPath, destinationPath) => {
            if (!extractedDataPath && !destinationPath) {
                throw new Error('The values are not defined');
            }
            return Promise.resolve();
        };

        await otAutoUpdater.moveAndCleanExtractedData(tmpExtractionPath, updateDirectory);

        otAutoUpdater.copyConfigFiles = (source, destination) => {
            if (!destination && !source) {
                throw new Error('The destination and source are not defined');
            }
            return Promise.resolve();
        };

        await otAutoUpdater.copyConfigFiles(currentDirectory, updateDirectory);

        otAutoUpdater.installDependencies = (destination) => {
            if (!destination) {
                throw new Error('The destination is not defined');
            }
            return Promise.resolve();
        };

        await otAutoUpdater.installDependencies(updateDirectory);

        otAutoUpdater.removeOldVersions = (currentVersionValue, newVersionValue) => {
            if (!currentVersionValue && !newVersionValue) {
                throw new Error('The values are not defined');
            }
            return Promise.resolve();
        };

        await otAutoUpdater.removeOldVersions(currentVersion, '6.0.14');

        const test = await otAutoUpdater.update();
    });

    it('failed update without initialization', async () => {
        autoUpdaterManager.initialized = false;

        try {
            await autoUpdaterManager.update();
        } catch (error) {
            expect(error.message).to.equal('Auto updater module is not initialized.');
        }
    });
});
