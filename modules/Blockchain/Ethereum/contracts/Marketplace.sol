pragma solidity ^0.4.0;

import './Hub.sol';

import {ERC725} from './ERC725.sol';
import {HoldingStorage} from './HoldingStorage.sol';
import {MarketplaceStorage} from './MarketplaceStorage.sol';
import {SafeMath} from './SafeMath.sol';
import {ProfileStorage} from "./ProfileStorage.sol";
import {Profile} from "./Profile.sol";

contract Marketplace {
    using SafeMath for uint256;

    Hub public hub;

    modifier onlyContracts(){
        require(hub.isContract(msg.sender),
            "Function can only be called by contracts!");
        _;
    }

    uint256 public paymentStageInterval = 5 minutes;

    constructor(address hubAddress) public {
        require(hubAddress != address(0));
        hub = Hub(hubAddress);
    }

    function setHubAddress(address newHubAddress)
    public onlyContracts {
        require(newHubAddress != address(0));
        hub = Hub(newHubAddress);
    }

    modifier onlyHolding(){
        require(msg.sender == hub.getContractAddress("Holding"),
            "Function can only be called by Holding contract!");
        _;
    }

    event PurchaseInitiated(bytes32 purchaseId, address sellerIdentity, address buyerIdentity, uint256 price, bytes32 encodedDataRootHash);
    event KeyRevealed(bytes32 purchaseId, bytes32 key);

    function initiatePurchase(
        address sellerIdentity,
        address buyerIdentity,
        uint price,
        bytes32 originalDataRootHash,
        bytes32 encodedDataRootHash
    ) public {
        require(uint256(sellerIdentity) != 0, "Cannot initiate purchase without seller id submitted");
        require(uint256(buyerIdentity) != 0, "Cannot initiate purchase without price submitted");
        require(uint256(originalDataRootHash) !=0, "Cannot initiate purchase without originalDataRootHash submitted");
        require(uint256(encodedDataRootHash) != 0, "Cannot initiate purchase without encodedDataRootHash submitted");

        require(ERC725(buyerIdentity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)), 2) || ERC725(buyerIdentity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)), 1), "Sender does not have proper permission to call this function!");

        // purchase_id is created as a hash of: sender, previous block hash, and data root hash
        bytes32 purchaseId = keccak256(abi.encodePacked(msg.sender, blockhash(block.number - 1), encodedDataRootHash));

        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setSeller(purchaseId, sellerIdentity);
        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setBuyer(purchaseId, buyerIdentity);

        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setPrice(purchaseId, price);

        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setOriginalDataRootHash(purchaseId, originalDataRootHash);
        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setEncodedDataRootHash(purchaseId, encodedDataRootHash);

        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setTimestamp(purchaseId, block.timestamp);
        MarketplaceStorage(hub.getContractAddress("MarketplaceStorage")).setStage(purchaseId, 1);

        // Secure funds from all parties
        reserveTokens(buyerIdentity, price);

        emit PurchaseInitiated(purchaseId, sellerIdentity, msg.sender, price, encodedDataRootHash);
    }

    // da li treba da validiramo i koji je buyer u pitanju
    // da li treba da validiramo da je za taj purchase id startovan purchase
    function revealKey(bytes32 purchaseId, bytes32 key) public {
        require(uint256(purchaseId) != 0, "Cannot reveal key without purchase id submitted");
        require(uint256(key) != 0, "Cannot reveal key without key submitted");


        MarketplaceStorage marketplaceStorage = MarketplaceStorage(hub.getContractAddress("MarketplaceStorage"));

        address sellerIdentity = marketplaceStorage.getSeller(purchaseId);
        require(ERC725(sellerIdentity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)), 2) || ERC725(sellerIdentity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)), 1), "Only seller can reveal key!");
        require(marketplaceStorage.getStage(purchaseId) == 1, "Key can only be revealed in the initiated stage");

        marketplaceStorage.setKey(purchaseId, key);

        marketplaceStorage.setTimestamp(purchaseId, block.timestamp);
        marketplaceStorage.setStage(purchaseId, 2);

        // Secure funds from all parties
        reserveTokens(sellerIdentity, marketplaceStorage.getPrice(purchaseId));

        emit KeyRevealed(purchaseId, key);
    }

    function takePayment(bytes32 purchaseId) public {
        MarketplaceStorage marketplaceStorage = MarketplaceStorage(hub.getContractAddress("MarketplaceStorage"));

        require(marketplaceStorage.getStage(purchaseId) == 2, "Payment can only be taken in the keyRevealed stage");
        require(block.timestamp > marketplaceStorage.getTimestamp(purchaseId) + paymentStageInterval, "Complaint window has not yet expired!");

        address buyerIdentity = marketplaceStorage.getBuyer(purchaseId);
        address sellerIdentity = marketplaceStorage.getSeller(purchaseId);
        uint256 price = marketplaceStorage.getPrice(purchaseId);

        ProfileStorage profileStorage = ProfileStorage(hub.getContractAddress("ProfileStorage"));

        require(profileStorage.getStake(buyerIdentity) >= price, "Buyer does not have enough tokens to transfer!");
        require(profileStorage.getStakeReserved(buyerIdentity) >= price, "Buyer does not have enough tokens reserved to transfer!");

        profileStorage.setStakeReserved(buyerIdentity, profileStorage.getStakeReserved(buyerIdentity).sub(price));
        profileStorage.setStake(buyerIdentity, profileStorage.getStake(buyerIdentity).sub(price));
        profileStorage.setStake(sellerIdentity, profileStorage.getStake(sellerIdentity).add(price));

        // Unlock seller stake tokens
        require(profileStorage.getStakeReserved(sellerIdentity) >= price, "Seller does not have enough tokens reserved to unlock!");
        profileStorage.setStakeReserved(sellerIdentity, profileStorage.getStakeReserved(sellerIdentity).sub(price));

        marketplaceStorage.setStage(purchaseId, 3);
        marketplaceStorage.setTimestamp(purchaseId, block.timestamp);
    }

    function reserveTokens(address party, uint256 amount)
    internal {
        ProfileStorage profileStorage = ProfileStorage(hub.getContractAddress("ProfileStorage"));

        if(profileStorage.getWithdrawalPending(party) &&
            profileStorage.getWithdrawalAmount(party).add(amount) > profileStorage.getStake(party) - profileStorage.getStakeReserved(party)) {

            profileStorage.setWithdrawalPending(party, false);
        }

        require(profileStorage.getStake(party).sub(profileStorage.getStakeReserved(party)) >= amount,
            "User does not have enough stake for reserving!");

        profileStorage.setStakeReserved(party, profileStorage.getStakeReserved(party).add(amount));
    }

}
