# Functional testing for OT-Node

This directory contains a set of functional tests designed to perform functional testing on the OT-Node.
Scenarios for BDD tests are written in Gherkin using [Cucumber](https://cucumber.io/docs/guides/overview/) framework. Unit tests are written in javascript, using [Mocha/Chai](https://mochajs.org/) as Test framework.

## Test flow

Tests are separated depending of their functional requirements. 
Unit tests are separated by modules in ```test/modules``` directory. Test file for a module may contain multiple tests.
BDD tests are separated by features and scenarios in ```test/bdd``` directory.


## Run the tests

Run unit tests from the root directory using the following command:
```
npm run test:unit
```

Run BDD tests from the root directory using the following command:
```
npm run test:bdd:[scenario_tag]
```


## Examples

An example of unit test for RSA encryption service:
https://github.com/OriginTrail/ot-node/blob/bbc5c9937f0be9bae7b23a05f372091642ac7675/test/modules/RSAencryption.test.js#L14


An example of unit BDD scenario for validating GS1-EPCIS dataset signature:
https://github.com/OriginTrail/ot-node/blob/bbc5c9937f0be9bae7b23a05f372091642ac7675/test/bdd/features/importer.feature#L6
