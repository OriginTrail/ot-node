pragma solidity ^0.4.25;

import {SafeMath} from "./SafeMath.sol";
import {ERC725} from './ERC725.sol';
import {Hub} from "./Hub.sol";
import {Holding} from "./Holding.sol";
import {Profile} from "./Profile.sol";
import {HoldingStorage} from "./HoldingStorage.sol";
import {ProfileStorage} from "./ProfileStorage.sol";
import {LitigationStorage} from "./LitigationStorage.sol";

contract Litigation {
    using SafeMath for uint256;

    Hub public hub;

    constructor (address hubAddress) public {
        hub = Hub(hubAddress);
    }

    function setHubAddress(address newHubAddress) public {
        require(hub.isContract(msg.sender), "This function can only be called by contracts or their creator!");

        hub = Hub(newHubAddress);
    }

	/*    ----------------------------- LITIGATION -----------------------------     */
    event LitigationInitiated(bytes32 offerId, address holderIdentity, uint requestedDataIndex);
    event LitigationAnswered(bytes32 offerId, address holderIdentity);
    event LitigationTimedOut(bytes32 offerId, address holderIdentity);
    event LitigationCompleted(bytes32 offerId, address holderIdentity, bool DH_was_penalized);

    event ReplacementStarted(bytes32 offerId, address holderIdentity, address challengerIdentity, bytes32 litigationRootHash);

    function initiateLitigation(bytes32 offerId, address holderIdentity, address challengerIdentity, uint requestedDataIndex, bytes32[] hashArray)
    public returns (bool newLitigationInitiated){
        HoldingStorage holdingStorage = HoldingStorage(hub.getContractAddress("HoldingStorage"));
        LitigationStorage litigationStorage = LitigationStorage(hub.getContractAddress("LitigationStorage"));
        require(holdingStorage.getOfferCreator(offerId) == challengerIdentity, "Challenger identity not equal to offer creator identity!");
        require(ERC725(challengerIdentity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)),2), "Sender does not have action purpose set!");

        LitigationStorage.LitigationStatus litigationStatus = litigationStorage.getLitigationStatus(offerId, holderIdentity);

        uint256 timestamp = litigationStorage.getLitigationTimestamp(offerId, holderIdentity);
        uint256 litigationIntervalInSeconds = holdingStorage.getOfferLitigationIntervalInMinutes(offerId).mul(60);

        require(litigationStatus != LitigationStorage.LitigationStatus.replacing,
            "The selected holder is already being replaced, cannot initiate litigation!");
        require(litigationStatus != LitigationStorage.LitigationStatus.replaced,
            "The selected holder is already replaced, cannot initiate litigation!");

        require(HoldingStorage(hub.getContractAddress("HoldingStorage")).getOfferStartTime(offerId)
            + HoldingStorage(hub.getContractAddress("HoldingStorage")).getOfferHoldingTimeInMinutes(offerId).mul(60)
            > block.timestamp
            ,"Cannot initate litigation for a completed offer!");

        if(litigationStatus == LitigationStorage.LitigationStatus.initiated) {
            require(timestamp + litigationIntervalInSeconds.mul(3) < block.timestamp, 
                "The litigation is initiated and awaiting holder response, cannot initiate another litigation!");
        } else if(litigationStatus == LitigationStorage.LitigationStatus.answered) {
            require(timestamp + litigationIntervalInSeconds.mul(2) < block.timestamp, 
                "The litigation is answered and awaiting previous litigator response, cannot initiate another litigation!");
        } else if(litigationStatus == LitigationStorage.LitigationStatus.initiated) {
            require(timestamp + litigationIntervalInSeconds < block.timestamp, 
                "The litigation interval has not passed yet, cannot initiate another litigation!");
        }

        // Write litigation information into the storage
        litigationStorage.setLitigationLitigatorIdentity(offerId, holderIdentity, challengerIdentity);
        litigationStorage.setLitigationRequestedDataIndex(offerId, holderIdentity, requestedDataIndex);
        litigationStorage.setLitigationHashArray(offerId, holderIdentity, hashArray);
        
        litigationStorage.setLitigationStatus(offerId, holderIdentity, LitigationStorage.LitigationStatus.initiated);
        litigationStorage.setLitigationTimestamp(offerId, holderIdentity, block.timestamp);

        emit LitigationInitiated(offerId, holderIdentity, requestedDataIndex);
        return true;
    }
    
    function answerLitigation(bytes32 offerId, address holderIdentity, bytes32 requestedData)
    public returns (bool answer_accepted){
        HoldingStorage holdingStorage = HoldingStorage(hub.getContractAddress("HoldingStorage"));
        LitigationStorage litigationStorage = LitigationStorage(hub.getContractAddress("LitigationStorage"));
        require(ERC725(holderIdentity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)),2), "Sender does not have action purpose set!");

        LitigationStorage.LitigationStatus litigationStatus = litigationStorage.getLitigationStatus(offerId, holderIdentity);

        require(litigationStatus == LitigationStorage.LitigationStatus.initiated, 
            "Litigation status is not set to initiated, cannot send answer!");
        require(litigationStorage.getLitigationTimestamp(offerId, holderIdentity) + holdingStorage.getOfferLitigationIntervalInMinutes(offerId).mul(60) >= block.timestamp, 
            "The interval for answering has passed, cannot answer litigation!");

        // Write answer data into the hash
        litigationStorage.setLitigationRequestedData(offerId, holderIdentity, keccak256(abi.encodePacked(requestedData, litigationStorage.getLitigationRequestedDataIndex(offerId, holderIdentity))));

        litigationStorage.setLitigationStatus(offerId, holderIdentity, LitigationStorage.LitigationStatus.answered);
        litigationStorage.setLitigationTimestamp(offerId, holderIdentity, block.timestamp);

        emit LitigationAnswered(offerId, holderIdentity);
        return true;
    }

    function completeLitigation(bytes32 offerId, address holderIdentity, address litigatorIdentity, bytes32 proofData)
    public returns (bool DH_was_penalized){
        HoldingStorage holdingStorage = HoldingStorage(hub.getContractAddress("HoldingStorage"));
        LitigationStorage litigationStorage = LitigationStorage(hub.getContractAddress("LitigationStorage"));
        ProfileStorage profileStorage = ProfileStorage(hub.getContractAddress("ProfileStorage"));
        
        require(holdingStorage.getOfferCreator(offerId) == litigatorIdentity, "Challenger identity not equal to offer creator identity!");
        require(ERC725(litigatorIdentity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)),2), "Sender does not have action purpose set!");
        require(litigationStorage.getLitigationLitigatorIdentity(offerId, holderIdentity) == litigatorIdentity, "Litigation can only be completed by the litigator who initiated the litigation!");

        uint256[] memory parameters = new uint256[](4);

        // set parameters[0] as the last litigation timestamp
        parameters[0] = litigationStorage.getLitigationTimestamp(offerId, holderIdentity);
        // set parameters[1] as the litigation interval in seconds
        parameters[1] = holdingStorage.getOfferLitigationIntervalInMinutes(offerId).mul(60);

       	LitigationStorage.LitigationStatus litigationStatus = litigationStorage.getLitigationStatus(offerId, holderIdentity);

        require(litigationStatus != LitigationStorage.LitigationStatus.replacing,
            "The selected holder is already being replaced, cannot call this function!");
        require(litigationStatus != LitigationStorage.LitigationStatus.replaced,
            "The selected holder is already replaced, cannot call this function!");
        require(litigationStatus != LitigationStorage.LitigationStatus.completed,
            "Cannot complete a completed litigation that is not initiated or answered!");

        if(holdingStorage.getHolderLitigationEncryptionType(offerId, holderIdentity) == 0){
            parameters[3] = uint256(holdingStorage.getOfferRedLitigationHash(offerId));
        } else if (holdingStorage.getHolderLitigationEncryptionType(offerId, holderIdentity) == 1) {
            parameters[3] = uint256(holdingStorage.getOfferGreenLitigationHash(offerId));
        } else {
            parameters[3] = uint256(holdingStorage.getOfferBlueLitigationHash(offerId));
        }

        if(litigationStatus == LitigationStorage.LitigationStatus.initiated) {
            // Litigator claims that the DH is inactive
            // Verify that the asnwer window has passes and that the completion window has not passed
            require(parameters[0] + parameters[1].mul(2) >= block.timestamp, 
                "The time window for completing the unanswered litigation has passed!");
            require(parameters[0] + parameters[1] < block.timestamp, 
                "The answer window has not passed, cannot complete litigation yet!");

            // DH is considered inactive, replace him regardless of the proofData
            startReplacement(offerId, holderIdentity, litigatorIdentity, parameters[3]);
            return true;
        }
        
        // The litigation status is answered, verify that the completion is happening during the completion time frame
        require(parameters[0] + parameters[1] >= block.timestamp, 
           "The time window for completing the answered litigation has passed!");
        

        if(calculateMerkleTrees(offerId, holderIdentity, proofData, bytes32(parameters[3]))) {
            // DH has the reRquested data -> Set litigation as completed, no transfer of tokens
            litigationStorage.setLitigationStatus(offerId, holderIdentity, LitigationStorage.LitigationStatus.completed);
            litigationStorage.setLitigationTimestamp(offerId, holderIdentity, block.timestamp);

            emit LitigationCompleted(offerId, holderIdentity, false);
            return false;
        }
        else {
            // DH didn't have the requested data, and the litigation was valid
            startReplacement(offerId, holderIdentity, litigatorIdentity, parameters[3]);
            return true;
        }
    }

    function startReplacement(bytes32 offerId, address holderIdentity, address litigatorIdentity, uint256 litigationRootHash) internal {
        HoldingStorage holdingStorage = HoldingStorage(hub.getContractAddress("HoldingStorage"));
        LitigationStorage litigationStorage = LitigationStorage(hub.getContractAddress("LitigationStorage"));
        ProfileStorage profileStorage = ProfileStorage(hub.getContractAddress("ProfileStorage"));
 
        // Pay the previous holder
        uint256 amountToTransfer = holdingStorage.getOfferTokenAmountPerHolder(offerId);
        // Multiply the tokenAmountPerHolder by the time the the holder held the data
        amountToTransfer = amountToTransfer.mul(litigationStorage.getLitigationTimestamp(offerId, holderIdentity).sub(holdingStorage.getHolderPaymentTimestamp(offerId, holderIdentity)));
        // Divide the tokenAmountPerHolder by the total time
        amountToTransfer = amountToTransfer.div(holdingStorage.getOfferHoldingTimeInMinutes(offerId).mul(60));

        require(holdingStorage.getHolderPaidAmount(offerId, holderIdentity).add(amountToTransfer) < holdingStorage.getHolderStakedAmount(offerId, holderIdentity),
            "Holder considered to successfully completed offer, cannot complete litigation!");

        // Increase previous holder Stake
        profileStorage.setStake(holderIdentity, profileStorage.getStake(holderIdentity).add(amountToTransfer));
        
        // Decrease offer creator Stake
        uint256 temp = profileStorage.getStake(holdingStorage.getOfferCreator(offerId));
        profileStorage.setStake(holdingStorage.getOfferCreator(offerId), temp.sub(amountToTransfer));
        
        // Decrease offer creator Stake reserved
        temp = profileStorage.getStakeReserved(holdingStorage.getOfferCreator(offerId));
        profileStorage.setStakeReserved(holdingStorage.getOfferCreator(offerId), temp.sub(amountToTransfer));
        
        // Increase holder paid amount
        temp = holdingStorage.getHolderPaidAmount(offerId, holderIdentity);
        holdingStorage.setHolderPaidAmount(offerId, holderIdentity, temp.add(amountToTransfer));

        litigationStorage.setLitigationStatus(offerId, holderIdentity, LitigationStorage.LitigationStatus.replacing);
        litigationStorage.setLitigationTimestamp(offerId, holderIdentity, block.timestamp);

        uint256 difficulty;
        if(holdingStorage.getDifficultyOverride() != 0) difficulty = holdingStorage.getDifficultyOverride();
        else {
            if(logs2(profileStorage.activeNodes()) <= 4) difficulty = 1;
            else {
                difficulty = 4 + (((logs2(profileStorage.activeNodes()) - 4) * 10000) / 13219);
            }
        }
        litigationStorage.setLitigationReplacementDifficulty(offerId, holderIdentity, difficulty);
            // Calculate and set task
        litigationStorage.setLitigationReplacementTask(offerId, holderIdentity, blockhash(block.number - 1) & bytes32(2 ** (difficulty * 4) - 1));

        emit LitigationCompleted(offerId, holderIdentity, true);
        emit ReplacementStarted(offerId, holderIdentity, litigatorIdentity, bytes32(litigationRootHash));
    }

    function calculateMerkleTrees(bytes32 offerId, address holderIdentity, bytes32 proofData, bytes32 litigationRootHash)
    internal returns (bool DHAnsweredCorrectly) {
        LitigationStorage litigationStorage = LitigationStorage(hub.getContractAddress("LitigationStorage"));
        
        uint256 i = 0;
        uint256 mask = 1;
        uint256 requestedDataIndex = litigationStorage.getLitigationRequestedDataIndex(offerId, holderIdentity);
        bytes32 answerHash = litigationStorage.getLitigationRequestedData(offerId, holderIdentity);
        bytes32 proofHash = keccak256(abi.encodePacked(proofData, requestedDataIndex));
        bytes32[] memory hashArray = litigationStorage.getLitigationHashArray(offerId, holderIdentity);

        // ako je bit 1 on je levo
        while (i < hashArray.length){
            uint256 selectedBit = mask << i;
            selectedBit = selectedBit & requestedDataIndex;
            if(selectedBit != 0) {
                proofHash = keccak256(abi.encodePacked(hashArray[i], proofHash));
                answerHash = keccak256(abi.encodePacked(hashArray[i], answerHash));
            }
            else {
                proofHash = keccak256(abi.encodePacked(proofHash, hashArray[i]));
                answerHash = keccak256(abi.encodePacked(answerHash, hashArray[i]));
            }
            i = i + 1;
        }
        return (answerHash == litigationRootHash || proofHash != litigationRootHash);
    }

    function logs2(uint x) internal pure returns (uint y){
        require(x > 0, "log(0) not allowed");
        assembly {
            let arg := x
            x := sub(x,1)
            x := or(x, div(x, 0x02))
            x := or(x, div(x, 0x04))
            x := or(x, div(x, 0x10))
            x := or(x, div(x, 0x100))
            x := or(x, div(x, 0x10000))
            x := or(x, div(x, 0x100000000))
            x := or(x, div(x, 0x10000000000000000))
            x := or(x, div(x, 0x100000000000000000000000000000000))
            x := add(x, 1)
            let m := mload(0x40)
            mstore(m,           0xf8f9cbfae6cc78fbefe7cdc3a1793dfcf4f0e8bbd8cec470b6a28a7a5a3e1efd)
            mstore(add(m,0x20), 0xf5ecf1b3e9debc68e1d9cfabc5997135bfb7a7a3938b7b606b5b4b3f2f1f0ffe)
            mstore(add(m,0x40), 0xf6e4ed9ff2d6b458eadcdf97bd91692de2d4da8fd2d0ac50c6ae9a8272523616)
            mstore(add(m,0x60), 0xc8c0b887b0a8a4489c948c7f847c6125746c645c544c444038302820181008ff)
            mstore(add(m,0x80), 0xf7cae577eec2a03cf3bad76fb589591debb2dd67e0aa9834bea6925f6a4a2e0e)
            mstore(add(m,0xa0), 0xe39ed557db96902cd38ed14fad815115c786af479b7e83247363534337271707)
            mstore(add(m,0xc0), 0xc976c13bb96e881cb166a933a55e490d9d56952b8d4e801485467d2362422606)
            mstore(add(m,0xe0), 0x753a6d1b65325d0c552a4d1345224105391a310b29122104190a110309020100)
            mstore(0x40, add(m, 0x100))
            let magic := 0x818283848586878898a8b8c8d8e8f929395969799a9b9d9e9faaeb6bedeeff
            let shift := 0x100000000000000000000000000000000000000000000000000000000000000
            let a := div(mul(x, magic), shift)
            y := div(mload(add(m,sub(255,a))), shift)
            y := add(y, mul(256, gt(arg, 0x8000000000000000000000000000000000000000000000000000000000000000)))
        }
    }
}