const express = require('express');
const https = require('https');
const fs = require('fs-extra');
const fileUpload = require('express-fileupload');
const { Validator } = require('express-json-validator-middleware');
const RequestValidationErrorMiddleware = require('./request-validation-error-middleware');
const authenticationMiddleware = require('./middleware/authentication-middleware');
const authorizationMiddleware = require('./middleware/authorization-middleware');

const { validate } = new Validator();

class ExpressHttpClient {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
        this.app = express();
    }

    async get(route, ...callback) {
        this.app.get(route, callback);
    }

    async post(route, requestSchema, ...callback) {
        this.app.post(route, validate({ body: requestSchema }), callback);
    }

    sendResponse(res, status, returnObject) {
        res.status(status);
        res.send(returnObject);
    }

    async listen() {
        if (this.config.useSsl) {
            this.httpsServer = https.createServer(
                {
                    key: fs.readFileSync(this.config.sslKeyPath),
                    cert: fs.readFileSync(this.config.sslCertificatePath),
                },
                this.app,
            );
            this.httpsServer.listen(this.config.port);
        } else {
            this.app.listen(this.config.port);
        }
        this.logger.info(`Node listening on port: ${this.config.port}`);
    }

    async initializeBeforeMiddlewares(authService) {
        this.app.use(authenticationMiddleware(authService));
        this.app.use(authorizationMiddleware(authService));
        this._initializeBaseMiddlewares();
    }

    async initializeAfterMiddlewares() {
        this.app.use(RequestValidationErrorMiddleware);
    }

    _initializeBaseMiddlewares() {
        this.app.use(
            fileUpload({
                createParentPath: true,
            }),
        );

        this.app.use(express.json());

        this.app.use((req, res, next) => {
            this.logger.api(`${req.method}: ${req.url} request received`);
            return next();
        });
    }
}

module.exports = ExpressHttpClient;
