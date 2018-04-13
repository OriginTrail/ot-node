'use-strict';

const config = require('./Config');
const Challenge = require('./Challenge');
const Utilities = require('./Utilities');
const MessageHandler = require('./MessageHandler');

const log = Utilities.getLogger();
const intervalMs = 1500;


function sendChallenge(challenge) {
    log.trace(`Sending challenge to ${challenge.dh_id}. Import ID ${challenge.import_id}, block ID ${challenge.block_id}.`);

    const payload = {
        payload: {
            block_id: challenge.block_id,
            import_id: challenge.import_id,
        },
    };


    MessageHandler.onDirectMessage('challenge-request').then((response) => {
        console.log(response);
        console.log('lalalalalalala');
    })

    // TODO: broadcast
    MessageHandler.sendDirectMessage(config.dh, 'challenge-request', payload)
        .then((response) => {
            log.info(`Challenge response: ${response}.`);

            if (response.answer === challenge.answer) {
                log.trace('Successfully answered to challenge.');
                // TODO doktor: Handle promise.
                Challenge.completeTest(challenge.id);
            } else {
                log.info(`Wrong answer to challenge '${response.answer} for DH ID ${challenge.dh_id}.'`);
                // TODO doktor: Handle promise.
                Challenge.failTest(challenge.id);
            }
        }, (error) => {
            log.error(`Failed to send challenge to ${challenge.dh_id}. Error: ${error}.`);
        });
}

function intervalFunc() {
    const time_now = Date.now();

    Challenge.getUnansweredTest(0, time_now + intervalMs).then((challenges) => {
        console.log(challenges);
        if (challenges.length > 0) {
            challenges.forEach(challenge => sendChallenge(challenge));
        } else {
            log.trace('No challenges found.');
        }
    }).catch((err) => {
        log.error(`Failed to get unanswered challenges. Error: ${err}.`);
    });
}

let timerId;
exports.intervalMs = intervalMs;

exports.startChallenging = function startChallenging() {
    if (timerId === undefined) {
        setInterval(intervalFunc, intervalMs);
        log.info(`Started challenging timer at ${intervalMs}ms.`);
    }
};

exports.stopChallenging = function stopChallenging() {
    if (timerId !== undefined) {
        clearTimeout(timerId);
        timerId = undefined;
        log.info('stopped challenging timer.');
    }
};

