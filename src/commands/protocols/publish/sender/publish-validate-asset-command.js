import ValidateAssetCommand from '../../../common/validate-asset-command.js';

class PublishValidateAssetCommand extends ValidateAssetCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
    }

    /**
     * Builds default publishValidateAssetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishValidateAssetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishValidateAssetCommand;
