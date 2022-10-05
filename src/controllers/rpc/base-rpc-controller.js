class BaseController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.protocolService = ctx.protocolService;
    }

    returnResponse(res, status, data) {
        res.status(status).send(data);
    }

    getCommandSequence(protocol) {
        const version = this.protocolService.toAwilixVersion(protocol);
        const { name } = this.protocolService.resolveProtocol(protocol);
        const capitalizedOperation = name.charAt(0).toUpperCase() + name.slice(1);

        return [
            `${version}Handle${capitalizedOperation}InitCommand`,
            `${version}Handle${capitalizedOperation}RequestCommand`,
        ];
    }
}

export default BaseController;
