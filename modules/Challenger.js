'use-strict';

const Challenge = require('./Challenge');
const Utilities = require('./Utilities');
const node = require('./Node');

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

    node.ot.challengeRequest(payload, challenge.dh, (error, response) => {
        if (error) {
            log.warn(`challenge-request: failed to get answer. Error: ${error}.`);
            return;
        }

        if (typeof response.status === 'undefined') {
            log.warn('challenge-request: Missing status');
            return;
        }

        if (response.status !== 'success') {
            log.trace('challenge-request: Response not successful.');
        }

        if (response.answer === challenge.answer) {
            log.trace('Successfully answered to challenge.');
            // TODO doktor: Handle promise.
            Challenge.completeTest(challenge.id);
        } else {
            log.info(`Wrong answer to challenge '${response.answer} for DH ID ${challenge.dh_id}.'`);
            // TODO doktor: Handle promise.
            Challenge.failTest(challenge.id);
        }
    });
}

function intervalFunc() {
    const time_now = Date.now();

    Challenge.getUnansweredTest(time_now - intervalMs, time_now + intervalMs).then((challenges) => {
        if (challenges.length > 0) {
            challenges.forEach(challenge => sendChallenge(challenge));
        } else {
            //  log.trace('No challenges found.');
        }
    }).catch((err) => {
        log.error(`Failed to get unanswered challenges. Error: ${err}.`);
    });
}

let timerId;
exports.intervalMs = intervalMs;

exports.startChallenging = function startChallenging() {
    if (timerId === undefined) {
        // TODO doktor: temp solution to delay.
        // Should be started after replication-finished received.
        setTimeout(() => {
            setInterval(intervalFunc, intervalMs);
        }, 30000);
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

