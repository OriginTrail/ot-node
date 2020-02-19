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

    function initiateSale(address _receiver, uint _price, bytes32 _keyCommit, bytes32 _root) public {

        // purchase id is created as hash from sender previous block hash and key committed
        bytes32 purchaseId = keccak256(abi.encodePacked(msg.sender, blockhash(block.number - 1), _keyCommit));

        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setSeller(purchaseId, msg.sender);

    }

}
