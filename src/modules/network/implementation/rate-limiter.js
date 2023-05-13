import { InMemoryRateLimiter } from 'rolling-rate-limiter';

import {
    NETWORK_API_RATE_LIMIT,
    NETWORK_API_SPAM_DETECTION,
    NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES,
} from '../../../constants/constants.js';

class RateLimiter {
    constructor(logger) {
        this.logger = logger;

        this.rateLimiter = {
            basicRateLimiter: new InMemoryRateLimiter({
                interval: NETWORK_API_RATE_LIMIT.TIME_WINDOW_MILLS,
                maxInInterval: NETWORK_API_RATE_LIMIT.MAX_NUMBER,
            }),
            spamDetection: new InMemoryRateLimiter({
                interval: NETWORK_API_SPAM_DETECTION.TIME_WINDOW_MILLS,
                maxInInterval: NETWORK_API_SPAM_DETECTION.MAX_NUMBER,
            }),
        };

        this.blackList = {};
    }

    async limitRequest(remotePeerId) {
        if (this.blackList[remotePeerId]) {
            const remainingMinutes = Math.floor(
                NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES -
                    (Date.now() - this.blackList[remotePeerId]) / (1000 * 60),
            );

            if (remainingMinutes > 0) {
                this.logger.debug(
                    `Blocking request from ${remotePeerId}. Node is blacklisted for ${remainingMinutes} minutes.`,
                );

                return true;
            }
            delete this.blackList[remotePeerId];
        }

        if (await this.rateLimiter.spamDetection.limit(remotePeerId)) {
            this.blackList[remotePeerId] = Date.now();
            this.logger.debug(
                `Blocking request from ${remotePeerId}. Spammer detected and blacklisted for ${NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES} minutes.`,
            );

            return true;
        }
        if (await this.rateLimiter.basicRateLimiter.limit(remotePeerId)) {
            this.logger.debug(
                `Blocking request from ${remotePeerId}. Max number of requests exceeded.`,
            );

            return true;
        }

        return false;
    }
}

export default RateLimiter;
