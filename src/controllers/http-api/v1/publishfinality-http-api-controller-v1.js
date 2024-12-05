import BaseController from '../base-http-api-controller.js';

// TODO
class PublishfinalityController extends BaseController {
    // constructor(ctx) {
    //     super(ctx);
    //     this. ...
    // }

    async handleRequest(req, res) {
        const { ual } = req.query;
        const isPublisherNode = true; // TODO: Check if node is the publisher of the ual
        if (!isPublisherNode)
            return this.returnResponse(res, 500, {
                message: 'Node is not the same node used for publish.',
            });
        const finality = ual ? 1 : 0; // TODO: Get current finality for ual
        return this.returnResponse(res, 200, { finality });
    }
}

export default PublishfinalityController;
