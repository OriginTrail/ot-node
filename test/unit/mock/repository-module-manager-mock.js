class RepositoryModuleManagerMock {
    responseStatuses = [
        {
            id: 1,
            operationId: 'f6354c2c-d460-11ed-afa1-0242ac120002',
            keyword: 'origintrail',
            status: 'COMPLETED',
            message: 'message',
            createdAt: '1970-01-01 00:00:00',
            updatedAt: '1970-01-01 00:00:00',
        },
    ];

    getAllPeerRecords() {
        return [
            {
                peerId: 'QmcJY13uLyt2VQ6QiVNcYiWaxdfaHWHj3T7G472uaHPBf7',
                blockchainId: 'ganache',
                ask: '0.2824612246520951',
                stake: '50000.0',
                lastSeen: '1970-01-01 00:00:00',
                lastDialed: '1970-01-01 00:00:00',
                sha256: '0x6e08776479a010d563855dbc371a66f692d3edcbcf2b02c30f9879ebe02244e8',
            },
            {
                peerId: 'Qmcxo88zf5zEvyBLYTrtfG8nGJQW6zHpf58b5MUcjoYVqL',
                blockchainId: 'ganache',
                ask: '0.11680988694381877',
                stake: '50000.0',
                lastSeen: '1970-01-01 00:00:00',
                lastDialed: '1970-01-01 00:00:00',
                sha256: '0x113d3da32b0e0b7031d188736792bbea0baf7911acb905511ac7dda2be9a6f55',
            },
            {
                peerId: 'QmQeNwBzgeMQxquQEDXvBHqXBHNBEvKHtyHURg4QvnoLrD',
                blockchainId: 'ganache',
                ask: '0.25255488168658036',
                stake: '50000.0',
                lastSeen: '1970-01-01 00:00:00',
                lastDialed: '1970-01-01 00:00:00',
                sha256: '0xba14ac66ab5be40bf458bad9b4e9f10a9d06375b233e91a6ce3c2d4cbf9deea5',
            },
            {
                peerId: 'QmU4ty8X8L4Xk6cbDCoyJUhgeBNLDo3HprTGEhNd9CtiT7',
                blockchainId: 'ganache',
                ask: '0.25263875217271087',
                stake: '50000.0',
                lastSeen: '1970-01-01 00:00:00',
                lastDialed: '1970-01-01 00:00:00',
                sha256: '0x5b3fdb88b3270a99cc89d28e0a4504d28789e5f8ca53080aa7608db48546d56b',
            },
            {
                peerId: 'QmWmgmMCQQ1awraTeQqwsbWgqtR3ZMuX7NhbHyiftuAspb',
                blockchainId: 'ganache',
                ask: '0.2429885059428509',
                stake: '50000.0',
                lastSeen: '1970-01-01 00:00:00',
                lastDialed: '1970-01-01 00:00:00',
                sha256: '0x820a8e38cb792b89c8b69eb9c192faf3def6175c97c4c0f17708161bcb9c5028',
            },
            {
                peerId: 'QmWyf3dtqJnhuCpzEDTNmNFYc5tjxTrXhGcUUmGHdg2gtj',
                blockchainId: 'ganache',
                ask: '0.210617584797714',
                stake: '50000.0',
                lastSeen: '1970-01-01 00:00:00',
                lastDialed: '1970-01-01 00:00:00',
                sha256: '0xf764186e9b675f3fd00af72026cf075d05ce8fc951ba089351d645b363acd3d3',
            },
            {
                peerId: 'QmXgeHgBVbd7iyTp8PapUAyeKciqbsXTEvsakCjW7wZRqT',
                blockchainId: 'ganache',
                ask: '0.2290449496761527',
                stake: '50000.0',
                lastSeen: '1970-01-01 00:00:00',
                lastDialed: '1970-01-01 00:00:00',
                sha256: '0xaaeed7b766483aef7cf2d07325f336b3e703e2b7573e540ca8c6e2aab34265c3',
            },
            {
                peerId: 'QmYys42KLmGEE9hEmJCVCe3SR3G9zf4epoAwDUK7pVUP6S',
                blockchainId: 'ganache',
                ask: '0.1637075464317365',
                stake: '50000.0',
                lastSeen: '1970-01-01 00:00:00',
                lastDialed: '1970-01-01 00:00:00',
                sha256: '0xc3bb7b5433ebe62ff9e98c6d439223d07d44e16e7d5e210e727823f87c0ef24b',
            },
            {
                peerId: 'QmZi2nDhZJfa1Z5iXjvxQ1BigpR8TdTQ3gWQDGecn34e9x',
                blockchainId: 'ganache',
                ask: '0.10242295311162795',
                stake: '50000.0',
                lastSeen: '1970-01-01 00:00:00',
                lastDialed: '1970-01-01 00:00:00',
                sha256: '0x510ca60cdd7b33bf8d978576981ae7f9caaf5f133ddd40693d8ce007614c0a09',
            },
            {
                peerId: 'QmZueq5jip24v5dbCSBGt8v16hPjUN1CXRb3zGaxH1jfHM',
                blockchainId: 'ganache',
                ask: '0.23374911902136858',
                stake: '50000.0',
                lastSeen: '1970-01-01 00:00:00',
                lastDialed: '1970-01-01 00:00:00',
                sha256: '0x7b4f717bd647104a72c7f1fce4600366982f36ebb1cef41540a5541c8e8ca1dd',
            },
        ];
    }

    getAllResponseStatuses() {
        return this.responseStatuses;
    }

    async getOperationResponsesStatuses(operation, operationId) {
        return this.responseStatuses.filter((rs) => rs.operationId === operationId);
    }

    async updateOperationIdRecord(data, operationId) {
        this.responseStatuses = this.responseStatuses.map((rs) =>
            rs.operationId === operationId
                ? { ...rs, status: data.status, updatedAt: data.timestamp }
                : rs,
        );
    }

    async updateOperationStatus(operation, operationId, status) {
        this.responseStatuses = this.responseStatuses.map((rs) =>
            rs.operationId === operationId
                ? { ...rs, status, updatedAt: new Date().toISOString() }
                : rs,
        );
    }

    async createOperationResponseRecord(status, operation, operationId, errorMessage) {
        this.responseStatuses = [
            ...this.responseStatuses,
            {
                id: this.responseStatuses[this.responseStatuses.length - 1].id + 1,
                status,
                operationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ];
    }
}

export default RepositoryModuleManagerMock;
