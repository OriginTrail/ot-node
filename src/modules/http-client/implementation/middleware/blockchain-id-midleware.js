function addBlockchainId(blockchain, blockchainImplementations) {
    let updatedBlockchain = blockchain;

    if (blockchain?.split(':').length === 1) {
        for (const implementation of blockchainImplementations) {
            if (implementation.split(':')[0] === blockchain) {
                updatedBlockchain = implementation;
                break;
            }
        }
    }

    return updatedBlockchain;
}

export default function blockchainIdMiddleware(blockchainImplementations) {
    return (req, res, next) => {
        if (req.method === 'GET')
            req.query.blockchain = addBlockchainId(req.query.blockchain, blockchainImplementations);
        else if (Array.isArray(req.body)) {
            for (const element of req.body) {
                element.blockchain = addBlockchainId(element.blockchain, blockchainImplementations);
            }
        } else {
            req.body.blockchain = addBlockchainId(req.body.blockchain, blockchainImplementations);
        }

        next();
    };
}
