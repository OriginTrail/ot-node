'use-strict';

const Challenge = require('./Challenge');

const intervalMs = 1500;

class Challenger {
    constructor(ctx) {
        this.log = ctx.logger;
        this.network = ctx.network;
    }

    startChallenging() {
        if (this.timerId === undefined) {
            // TODO doktor: temp solution to delay.
            // Should be started after replication-finished received.
            setTimeout(() => {
                setInterval(this.intervalFunc, intervalMs, this);
            }, 30000);
            this.log.info(`Started challenging timer at ${intervalMs}ms.`);
        }
    }

    stopChallenging() {
        if (this.timerId !== undefined) {
            clearTimeout(this.timerId);
            this.timerId = undefined;
            this.log.info('stopped challenging timer.');
        }
    }

    sendChallenge(challenge) {
        this.log.trace(`Sending challenge to ${challenge.dh_id}. Import ID ${challenge.import_id}, block ID ${challenge.block_id}.`);

        const payload = {
            payload: {
                block_id: challenge.block_id,
                import_id: challenge.import_id,
            },
        };

        this.network.kademlia().challengeRequest(payload, challenge.dh_id, (error, response) => {
            if (error) {
                this.log.warn(`challenge-request: failed to get answer. Error: ${error}.`);
                return;
            }

            if (typeof response.status === 'undefined') {
                this.log.warn('challenge-request: Missing status');
                return;
            }

            if (response.status !== 'success') {
                this.log.trace('challenge-request: Response not successful.');
            }

            if (response.answer === challenge.answer) {
                this.log.trace('Successfully answered to challenge.');
                // TODO doktor: Handle promise.
                Challenge.completeTest(challenge.id);
            } else {
                this.log.info(`Wrong answer to challenge '${response.answer} for DH ID ${challenge.dh_id}.'`);
                // TODO doktor: Handle promise.
                Challenge.failTest(challenge.id);
            }
        });
    }

    intervalFunc(challenger) {
        const time_now = Date.now();
        Challenge.getUnansweredTest(time_now - intervalMs, time_now + intervalMs)
            .then((challenges) => {
                if (challenges.length > 0) {
                    challenges.forEach(challenge => challenger.sendChallenge(challenge));
                } else {
                //  log.trace('No challenges found.');
                }
            }).catch((err) => {
                this.log.error(`Failed to get unanswered challenges. Error: ${err}.`);
            });
    }
}

module.exports = Challenger;
