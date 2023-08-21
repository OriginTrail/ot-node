import { describe, it, beforeEach } from 'mocha';
import { expect, assert } from 'chai';
import { readFile } from 'fs/promises';
import AutoUpdaterModuleManager from '../../../../src/modules/auto-updater/auto-updater-module-manager.js';
import Logger from '../../../../src/logger/logger.js';

let autoUpdaterManager;

const config = JSON.parse(await readFile('./test/unit/modules/auto-updater/config.json', 'utf-8'));

describe('Auto-updater module manager', async () => {
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

    it('failed update without initialization', async () => {
        autoUpdaterManager.initialized = false;

        try {
            await autoUpdaterManager.update();
        } catch (error) {
            expect(error.message).to.equal('Auto updater module is not initialized.');
        }
    });
});
