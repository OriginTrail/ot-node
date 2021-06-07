const Models = require('../../../models');
const Command = require('../command');
const Utilities = require('../../Utilities');

class DcConvertToGraphCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.importWorkerController = ctx.importWorkerController;
        this.commandExecutor = ctx.commandExecutor;
        this.logger = ctx.logger;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        try {
            const { handler_id, documentPath, data_set_id } = command.data;
            const dataInfo = await Models.data_info.findOne({
                where: { data_set_id },
                include: [
                    {
                        model: Models.data_provider_wallets,
                        attributes: ['wallet', 'blockchain_id'],
                    },
                ],
            });

            if (dataInfo) {
                this.logger.info(`Import already executed for dataset ${data_set_id}`);

                await Utilities.deleteDirectory(documentPath);

                // Set import process as completed
                await Models.handler_ids.update(
                    {
                        status: 'COMPLETED',
                        data: JSON.stringify({
                            dataset_id: data_set_id,
                            import_time: dataInfo.import_timestamp,
                            otjson_size_in_bytes: dataInfo.otjson_size_in_bytes,
                            root_hash: dataInfo.root_hash,
                            data_hash: dataInfo.data_hash,
                            message: 'Dataset already imported on the node, importing skipped',
                        }),
                    },
                    {
                        where: {
                            handler_id,
                        },
                    },
                );

                return Command.empty();
            }

            await this.importWorkerController.startGraphConverterWorker(command);
        } catch (error) {
            await this.commandExecutor.add({
                name: 'dcFinalizeImportCommand',
                delay: 0,
                transactional: false,
                data: {
                    error: { message: error.message },
                    handler_id: command.data.handler_id,
                    documentPath: command.data.documentPath,
                },
            });
        }
        return Command.empty();
    }

    /**
     * Builds default dcConvertToGraphCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcConvertToGraphCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcConvertToGraphCommand;
