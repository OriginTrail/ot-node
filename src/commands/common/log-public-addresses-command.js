import ip from 'ip';
import Command from '../command.js';
import { NODE_ENVIRONMENTS } from '../../constants/constants.js';

class LogPublicAddressesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.networkModuleManager = ctx.networkModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute() {
        if (
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.DEVELOPMENT &&
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.DEVNET
        )
            return Command.empty();

        const publicAddressesMap = {};

        await Promise.all(
            this.blockchainModuleManager.getImplementationNames().map(async (blockchain) => {
                const peers = await this.repositoryModuleManager.getAllPeerRecords(blockchain);
                await Promise.all(
                    peers.map(async (p) => {
                        let peerInfo = await this.networkModuleManager
                            .getPeerInfo(p.peerId)
                            .catch(() => ({ addresses: [] }));
                        if (!peerInfo?.addresses.length) {
                            peerInfo = { addresses: [] };
                        }

                        publicAddressesMap[p.peerId] = peerInfo.addresses
                            .map((addr) => addr.multiaddr)
                            .filter((addr) => addr.isThinWaistAddress())
                            .filter((addr) => !ip.isPrivate(addr.toString().split('/')[2]));
                    }),
                );
            }),
        );

        this.logger.debug(
            `Found public addresses for sharding table peers: ${JSON.stringify(
                publicAddressesMap,
                null,
                2,
            )}`,
        );

        return Command.repeat();
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command) {
        this.logger.warn(`Failed to log public addresses: error: ${command.message}`);
        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'logPublicAddressesCommand',
            data: {},
            period: 60 * 1000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default LogPublicAddressesCommand;
