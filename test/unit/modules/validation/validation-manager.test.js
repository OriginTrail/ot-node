import { describe, it, before, beforeEach, afterEach, after } from 'mocha';
import { expect, assert } from 'chai';
import { readFile } from 'fs/promises';
import { formatAssertion, calculateRoot } from 'assertion-tools';
import ValidationModuleManager from '../../../../src/modules/validation/validation-module-manager.js';
import Logger from '../../../../src/logger/logger.js';
import ModuleConfigValidation from '../../../../src/modules/module-config-validation.js';
import assertions from '../../../assertions/assertions.js';

let validationManager;
const config = JSON.parse(await readFile('./test/unit/modules/validation/config.json', 'utf-8'));

describe.only('Validation module manager test', async () => {
    before('initialize base module manage', () => {
        validationManager = new ValidationModuleManager({
            config,
            logger: new Logger(),
            moduleConfigValidation: new ModuleConfigValidation(),
        });
    });
    it('validates module name', async () => {
        const name = await validationManager.getName();
        console.log(name);
    });
});
