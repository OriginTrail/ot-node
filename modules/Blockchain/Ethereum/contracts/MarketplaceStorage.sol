pragma solidity ^0.4.0;

contract MarketplaceStorage {

    Hub public hub;

    constructor(address hubAddress) public {
        hub = Hub(hubAddress);
        activeNodes = 1;
    }

    function setHubAddress(address newHubAddress)
    public onlyContracts {
        require(newHubAddress != address(0));
        hub = Hub(newHubAddress);
    }

    modifier onlyContracts(){
        require(hub.isContract(msg.sender),
            "Function can only be called by contracts!");
        _;
    }

    struct PurchaseDefinition{
        address seller;
        address buyer;
        uint price;
        uint keyCommit;
        uint key;
        bytes32 root;

//        uint256 stake;
//        uint256 stakeReserved;
//        uint256 reputation;
//        bool withdrawalPending;
//        uint256 withdrawalTimestamp;
//        uint256 withdrawalAmount;
//        bytes32 nodeId;
    }
    mapping(bytes32 => SaleDefinition) public purchase;


    function setSeller (bytes32 purchaseId, address sellerAddress)
    public onlyContracts {
        purchase[purchaseId].seller = sellerAddress;
    }
}
