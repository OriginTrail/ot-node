const validationFunction = require('./validation-functions');
const { graph: dataset } = require('../../test/modules/test_data/otjson-graph');

class Validator {
    static validateDataset(dataset) {
        const { validationSchemas } = dataset.datasetHeader;

        const validationData = this.extractDataForValidation(dataset);

        for (const obj of validationData) {
            const regex = /^\/schemas\/([-\w]+)$/g;
            const splitted = regex.exec(obj.validationSchema);

            if (!splitted) {
                return {
                    valid: false,
                    message: `Invalid schema path: ${obj.validationSchema}`,
                };
            }

            const schemaName = splitted[1];

            const schemaData = validationSchemas[schemaName];

            if (schemaData == null) {
                return {
                    valid: false,
                    message: `Missing information for schema ${schemaName}`,
                };
            }
            // const shemaValidationResult = validationFunction[schemaName](schemaData, obj);

            // console.log(schemaName);
        }
        //
        // console.log(validationData);

        return {
            valid: true,
            message: 'Valid dataset',
        };
    }

    static _extractForValidation(obj, dataList) {
        if (typeof obj !== 'object' || obj == null) {
            return;
        }

        if (obj.validationSchema != null) {
            dataList.push(obj);
        }

        for (const key of Object.keys(obj)) {
            this._extractForValidation(obj[key], dataList);
        }
    }

    static extractDataForValidation(dataset) {
        const dataList = [];
        this._extractForValidation(dataset, dataList);
        return dataList;
    }
}

// const schemas = {
//     'erc725-main': {
//         networkId: 'ganache',
//         schemaType: 'ethereum-725',
//     },
//     merkleRoot: {
//         hubContractAddress: '0x6E9d88d683B7c4c24BC2cA2e188BAc6691708956',
//         networkId: 'ganache',
//         schemaType: 'merkle-root',
//     },
// };

module.exports = Validator;
//
// Validator.validateDataset(dataset);
