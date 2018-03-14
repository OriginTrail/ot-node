const utilities = require('./utilities')();

const log = utilities.getLogger();
const storage = require('./storage')();

module.exports = function () {
    const holding = {
        addHoldingData(dh_wallet, data_id, public_key, callback) {
            storage.getObject('Holding', (response) => {
                if (response.length === 0) {
                    // eslint-disable-next-line no-param-reassign
                    response = { data: [] };
                }

                for (const i in response.data) {
                    // eslint-disable-next-line max-len
                    if (response.data[i].dh_wallet === dh_wallet && response.data[i].data_id === data_id) {
                        utilities.executeCallback(callback, true);
                        return;
                    }
                }

                new_data = {
                    dh_wallet, data_id, public_key, confirmation_number: 0,
                };
                log.info(JSON.stringify(new_data));
                response.data.push(new_data);

                storage.storeObject('Holding', response, (status) => {
                    utilities.executeCallback(callback, true);
                });
            });
        },

        getHoldingData(dh_wallet, data_id, callback) {
            storage.getObject('Holding', (response) => {
                if (response.length === 0 || response.data.length === 0) {
                    utilities.executeCallback(callback, {});
                    return;
                }

                for (const i in response.data) {
                    // eslint-disable-next-line max-len
                    if (response.data[i].dh_wallet === dh_wallet && response.data[i].data_id === data_id) {
                        utilities.executeCallback(callback, response.data[i]);
                        return;
                    }
                }

                utilities.executeCallback(callback, {});
            });
        },

        increaseConfirmationVerificationNumber(dh_wallet, data_id, callback) {
            storage.getObject('Holding', (response) => {
                if (response.length === 0) {
                    utilities.executeCallback(callback, false);
                    return;
                }

                for (const i in response.data) {
                    // eslint-disable-next-line max-len
                    if (response.data[i].dh_wallet === dh_wallet && response.data[i].data_id === data_id) {
                        response.data[i].confirmation_number += 1;
                    }
                }

                storage.storeObject('Holding', response, (status) => {
                    utilities.executeCallback(callback, true);
                });
            });
        },
    };

    return holding;
};
