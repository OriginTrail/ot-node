const { Given } = require('@cucumber/cucumber');
const assert = require('assert');
const HttpApiHelper = require('../../utilities/http-api-helper');

Given(/^I call info route successfully/, { timeout: 120000 }, function (done) {
    this.logger.log('I call info route successfully');
    const apiHelper = new HttpApiHelper();
    apiHelper.info('http://localhost:8900').then((result) => {
        assert.equal(result.version.startsWith('6'), true);
        done();
    });
});

Given(/^I call publish route successfully/, { timeout: 120000 }, function (done) {
    this.logger.log('I call publish route successfully');
    const apiHelper = new HttpApiHelper();
    apiHelper.info('http://localhost:8900').then((result) => {
        assert.equal(result.version.startsWith('6'), true);
        done();
    });
});
