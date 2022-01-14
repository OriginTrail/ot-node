const Command = require("../command");

class SendAssertionCommand extends Command {
  constructor(ctx) {
    super(ctx);
    this.logger = ctx.logger;
    this.config = ctx.config;
    this.networkService = ctx.networkService;
    this.publishService = ctx.publishService;
  }

  /**
   * Executes command and produces one or more events
   * @param command
   */
  async execute(command) {
    const { rdf, assertion, assets, keywords } = command.data;

    let nodes = [];
    for (const keyword of keywords) {
      this.logger.info(
        `Searching for closest ${this.config.replicationFactor} node(s) for keyword ${keyword}`
      );
      const foundNodes = await this.networkService.findNodes(
        keyword,
        this.config.replicationFactor
      );
      if (foundNodes.length < this.config.replicationFactor) {
        this.logger.warn(
          `Found only ${foundNodes.length} node(s) for keyword ${keyword}`
        );
      }
      nodes = nodes.concat(foundNodes);
    }
    nodes = [...new Set(nodes)];

    for (const node of nodes) {
      this.publishService.store({ rdf, id: assertion.id }, node).catch((e) => {
        this.logger.error(
          `Error while sending data with assertion id ${assertion.id} to node ${node._idB58String}. Error message: ${e.message}. ${e.stack}`
        );
        this.logger.emit({
          msg: "Telemetry logging error at sending assertion command",
          Operation_name: "Error",
          Event_name: "SendAssertionError",
          Event_value1: e.message,
          Id_operation: "Undefined",
        });
      });
    }

    return this.continueSequence(command.data, command.sequence);
  }

  /**
   * Builds default dcConvertToOtJsonCommand
   * @param map
   * @returns {{add, data: *, delay: *, deadline: *}}
   */
  default(map) {
    const command = {
      name: "sendAssertionCommand",
      delay: 0,
      transactional: false,
    };
    Object.assign(command, map);
    return command;
  }
}

module.exports = SendAssertionCommand;
