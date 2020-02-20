pragma solidity ^0.4.0;

contract Marketplace {
    Hub public hub;

    constructor(address hubAddress) public {
        require(hubAddress != address(0));
        hub = Hub(hubAddress);
    }

    modifier onlyHolding(){
        require(msg.sender == hub.getContractAddress("Holding"),
            "Function can only be called by Holding contract!");
        _;
    }

    event PurchaseInitiated(bytes32 purchaseId, bytes32 seller, bytes32 buyer, bytes32 price, bytes32 encodingRootHash);
    event KeyRevealed(bytes32 purchaseId, bytes32 key);

    function initiatePurchase(address seller, uint price, bytes32 encodingRootHash) public {
        require(uint256(seller) != 0, "Cannot initiate purchase without seller id submitted");
        require(uint256(price) != 0, "Cannot initiate purchase without price submitted");
        require(uint256(encodingRootHash) != 0, "Cannot initiate purchase without encodingRootHash submitted");
        // purchase id is created as hash from sender previous block hash and key committed
        bytes32 purchaseId = keccak256(abi.encodePacked(msg.sender, blockhash(block.number - 1), _keyCommit));

        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setSeller(purchaseId, msg.seller);

        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setBuyer(purchaseId, msg.sender);

        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setPrice(purchaseId, price);

        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setEncodingRootHash(purchaseId, encodingRootHash);

        //emmit purchase initiated event
        emit PurchaseInitiated(purchaseId, seller, msg.sender, price, encodingRootHash);
    }
    // da li treba da validiramo i koji je buyer u pitanju
    // da li treba da validiramo da je za taj purchase id startovan purchase
    function revealKey(bytes32 purchaseId, bytes32 key) public {
        require(uint256(purchaseId) != 0, "Cannot call reveal key without purchase id submitted");
        require(uint256(key) != 0, "Cannot call reveal key without key submitted");

        require(uint256(msg.sender) == MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).getSeller(purchaseId), "Only seller can reveal key");

        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setKey(purchaseId, key);

        emit KeyRevealed(purchaseId, key);
    }

    function complain(bytes32 purchaseId)

}
