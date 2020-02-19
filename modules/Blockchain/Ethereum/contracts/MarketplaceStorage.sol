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
        uint keyCommit;
        uint price;
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
    mapping(bytes32 => PurchaseDefinition) public purchase;


    function setSeller (bytes32 purchaseId, address sellerAddress)
    public onlyContracts {
        purchase[purchaseId].seller = sellerAddress;
    }

    function getSeller (bytes32 purchaseId)
    public view returns(address seller){
        return purchase[purchaseId].seller;
    }

    function setBuyer (bytes32 purchaseId, address buyerAddress)
    public onlyContracts {
        purchase[purchaseId].buyer = buyerAddress;
    }

    function getBuyer (bytes32 purchaseId)
    public view returns(address buyer){
        return purchase[purchaseId].buyer;
    }

    function setKeyCommit (bytes32 purchaseId, uint keyCommit)
    public onlyContracts {
        purchase[purchaseId].keyCommit = keyCommit;
    }

    function getKeyCommit (bytes32 purchaseId)
    public view returns(uint keyCommit){
        return purchase[purchaseId].keyCommit;
    }

    function setPrice (bytes32 purchaseId, uint price)
    public onlyContracts {
        purchase[purchaseId].price = price;
    }

    function getPrice (bytes32 purchaseId)
    public view returns(uint price){
        return purchase[purchaseId].price;
    }

    function setKey (bytes32 purchaseId, uint key)
    public onlyContracts {
        purchase[purchaseId].key = key;
    }

    function getKey (bytes32 purchaseId)
    public view returns(uint key){
        return purchase[purchaseId].key;
    }
}
