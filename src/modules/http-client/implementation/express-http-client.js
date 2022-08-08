const express = require('express');
const https = require('https');
const fs = require('fs-extra');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const requestValidationMiddleware = require('./request-validation-middleware');
const rateLimiterMiddleware = require('./rate-limiter-middleware');

class ExpressHttpClient {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
        this.app = express();

        this.app.use(
            fileUpload({
                createParentPath: true,
            }),
        );

        this.app.use(cors());

        this.app.use(express.json());

        this.app.use((req, res, next) => {
            this.logger.api(`${req.method}: ${req.url} request received`);
            return next();
        });
    }

    async get(route, callback, options) {
        this.app.get(route, ...this.selectMiddlewares(options), callback);
    }

    async post(route, callback, options) {
        this.app.post(route, ...this.selectMiddlewares(options), callback);
    }

    sendResponse(res, status, returnObject) {
        res.status(status);
        res.send(returnObject);
    }

    async listen() {
        if (this.config.useSsl) {
            this.httpsServer = https.createServer(
                {
                    key: await fs.promises.readFile(this.config.sslKeyPath),
                    cert: await fs.promises.readFile(this.config.sslCertificatePath),
                },
                this.app,
            );
            this.httpsServer.listen(this.config.port);
        } else {
            this.app.listen(this.config.port);
        }
        this.logger.info(`Node listening on port: ${this.config.port}`);
    }

    selectMiddlewares(options) {
        const middlewares = [];
        if (options.rateLimit) middlewares.push(rateLimiterMiddleware(this.config.rateLimiter));
        if (options.requestSchema)
            middlewares.push(requestValidationMiddleware(options.requestSchema));

        return middlewares;
    }
}

module.exports = ExpressHttpClient;
