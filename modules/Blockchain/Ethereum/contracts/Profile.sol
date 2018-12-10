pragma solidity ^0.4.23;

import {SafeMath} from './SafeMath.sol';
import {ProfileStorage} from './ProfileStorage.sol';
import {Ownable, Hub} from './Hub.sol';
import {Identity, ERC725} from './Identity.sol';
import {ERC20} from './TracToken.sol';


contract Profile {
    using SafeMath for uint256;
    Hub public hub;
    ProfileStorage public profileStorage;

    uint256 public minimalStake = 10**21;
    uint256 public withdrawalTime = 5 minutes;

    constructor(address hubAddress) public {
        require(hubAddress != address(0));
        hub = Hub(hubAddress);
        profileStorage = ProfileStorage(hub.profileStorageAddress());
    }

    modifier onlyHolding(){
        require(msg.sender == hub.holdingAddress(),
        "Function can only be called by Holding contract!");
        _;
    }
    
    event ProfileCreated(address profile, uint256 initialBalance);
    event IdentityCreated(address profile, address newIdentity);
    event TokenDeposit(address profile, uint256 amount);

    event TokensDeposited(address profile, uint256 amountDeposited, uint256 newBalance);
    event TokensReserved(address profile, uint256 amountReserved);
    
    event WithdrawalInitiated(address profile, uint256 amount, uint256 withdrawalDelayInSeconds);
    event TokenWithdrawalCancelled(address profile);
    event TokensWithdrawn(address profile, uint256 amountWithdrawn, uint256 newBalance);

    event TokensReleased(address profile, uint256 amount);
    event TokensTransferred(address sender, address receiver, uint256 amount);
    
    function createProfile(bytes32 profileNodeId, uint256 initialBalance, bool senderHas725, address identity) public {
        ERC20 tokenContract = ERC20(hub.tokenAddress());
        require(tokenContract.allowance(msg.sender, this) >= initialBalance, "Sender allowance must be equal to or higher than initial balance");
        require(tokenContract.balanceOf(msg.sender) >= initialBalance, "Sender balance must be equal to or higher than initial balance!");
        require(uint256(profileNodeId) != 0, "Cannot create a profile without a nodeId submitted");

        tokenContract.transferFrom(msg.sender, address(profileStorage), initialBalance);

        if(!senderHas725) {
            Identity newIdentity = new Identity(msg.sender);
            emit IdentityCreated(msg.sender, address(newIdentity));

            profileStorage.setStake(address(newIdentity), initialBalance);
            profileStorage.setNodeId(address(newIdentity), profileNodeId);

            emit ProfileCreated(address(newIdentity), initialBalance);
        }
        else {
            // Verify sender
            require(ERC725(identity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)), 2));

            profileStorage.setStake(identity, initialBalance);
            profileStorage.setNodeId(identity, profileNodeId);

            emit ProfileCreated(identity, initialBalance);
        }

        if(initialBalance > minimalStake) {
            uint256 activeNodes = profileStorage.activeNodes();
            activeNodes += 1;
            profileStorage.setActiveNodes(activeNodes);
        }
    }

    function depositTokens(address identity, uint256 amount) public {
        // Verify sender
        require(ERC725(identity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)), 2));

        ERC20 tokenContract = ERC20(hub.tokenAddress());
        require(tokenContract.allowance(msg.sender, this) >= amount, "Sender allowance must be equal to or higher than chosen amount");
        require(tokenContract.balanceOf(msg.sender) >= amount, "Sender balance must be equal to or higher than chosen amount!");

        tokenContract.transferFrom(msg.sender, address(profileStorage), amount);

        profileStorage.setStake(identity, profileStorage.getStake(identity).add(amount));

        emit TokensDeposited(identity, amount, profileStorage.getStake(identity).add(amount));
    }

    function startTokenWithdrawal(address identity, uint256 amount) public {
        // Verify sender
        require(ERC725(identity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)), 2));

        require(profileStorage.getWithdrawalPending(identity) == false, "Withrdrawal process already pending!");

        uint256 availableBalance = profileStorage.getStake(identity).sub(profileStorage.getStakeReserved(identity));

        profileStorage.setWithdrawalPending(identity, true);
        profileStorage.setWithdrawalTimestamp(identity, block.timestamp + withdrawalTime);
        if(availableBalance >= amount) {
            // Reserve chosen token amount
            profileStorage.setWithdrawalAmount(identity, amount);
            emit WithdrawalInitiated(identity, amount, withdrawalTime);
        }
        else {
            // Reserve only the available balance
            profileStorage.setWithdrawalAmount(identity, availableBalance);
            emit WithdrawalInitiated(identity, availableBalance, withdrawalTime);
        }
    }

    function withdrawTokens(address identity) public {
        // Verify sender
        require(ERC725(identity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)), 2),  "Sender does not have action permission for identity!");

        require(profileStorage.getWithdrawalPending(identity) == true, "Cannot withdraw tokens before starting token withdrawal!");
        require(profileStorage.getWithdrawalTimestamp(identity) < block.timestamp, "Cannot withdraw tokens before withdrawal timestamp!");

        // Transfer already reserved tokens to user identity
        profileStorage.transferTokens(msg.sender, profileStorage.getWithdrawalAmount(identity));
        
        profileStorage.setStake(
            identity,
            profileStorage.getStake(identity).sub(profileStorage.getWithdrawalAmount(identity))
        );

        profileStorage.setWithdrawalPending(identity, false);
        
        emit TokensWithdrawn(
            identity,
            profileStorage.getWithdrawalAmount(identity),
            profileStorage.getStake(identity).sub(profileStorage.getWithdrawalAmount(identity))
        );
    }

    function setNodeId(address identity, bytes32 newNodeId)
    public {
         // Verify sender
        require(ERC725(identity).keyHasPurpose(keccak256(abi.encodePacked(msg.sender)), 2),
            "Sender does not have action permission for submitted identity");
        require(uint256(newNodeId) != 0, "Cannot set a blank nodeId");

        profileStorage.setNodeId(identity, newNodeId);
    }

    function reserveTokens(address payer, address identity1, address identity2, address identity3, uint256 amount)
    public onlyHolding {
        if(profileStorage.getWithdrawalPending(payer)) {
            profileStorage.setWithdrawalPending(payer,false);
            emit TokenWithdrawalCancelled(payer);
        }
        if(profileStorage.getWithdrawalPending(identity1)) {
            profileStorage.setWithdrawalPending(identity1,false);
            emit TokenWithdrawalCancelled(identity1);
        }
        if(profileStorage.getWithdrawalPending(identity2)) {
            profileStorage.setWithdrawalPending(identity2,false);
            emit TokenWithdrawalCancelled(identity2);
        }
        if(profileStorage.getWithdrawalPending(identity3)) {
            profileStorage.setWithdrawalPending(identity3,false);
            emit TokenWithdrawalCancelled(identity3);
        }

        require(minimalStake <= profileStorage.getStake(payer).sub(profileStorage.getStakeReserved(payer)),
            "Data creator does not have enough stake to take new jobs!");
        require(minimalStake <= profileStorage.getStake(identity1).sub(profileStorage.getStakeReserved(identity1)),
            "First profile does not have enough stake to take new jobs!");
        require(minimalStake <= profileStorage.getStake(identity2).sub(profileStorage.getStakeReserved(identity2)),
            "Second profile does not have enough stake to take new jobs!");
        require(minimalStake <= profileStorage.getStake(identity3).sub(profileStorage.getStakeReserved(identity3)),
            "Third profile does not have enough stake to take new jobs!");
        
        require(profileStorage.getStake(payer).sub(profileStorage.getStakeReserved(payer)) >= amount.mul(3), 
            "Data creator does not have enough stake for reserving!");
        require(profileStorage.getStake(identity1).sub(profileStorage.getStakeReserved(identity1)) >= amount, 
            "First profile does not have enough stake for reserving!");
        require(profileStorage.getStake(identity2).sub(profileStorage.getStakeReserved(identity2)) >= amount, 
            "Second profile does not have enough stake for reserving!");
        require(profileStorage.getStake(identity3).sub(profileStorage.getStakeReserved(identity3)) >= amount, 
            "Third profile does not have enough stake for reserving!");


        profileStorage.increaseStakesReserved(
            payer,
            identity1,
            identity2,
            identity3,
            amount
        );
        emit TokensReserved(payer, amount.mul(3));
        emit TokensReserved(identity1, amount);
        emit TokensReserved(identity2, amount);
        emit TokensReserved(identity3, amount);
    }

    function releaseTokens(address profile, uint256 amount)
    public onlyHolding {
        require(profileStorage.getStakeReserved(profile) >= amount, "Cannot release more tokens than there are reserved");

        profileStorage.setStakeReserved(profile, profileStorage.getStakeReserved(profile).sub(amount));

        emit TokensReleased(profile, amount);
    }
    
    function transferTokens(address sender, address receiver, uint256 amount)
    public onlyHolding {
        require(profileStorage.getStake(sender) >= amount, "Sender does not have enough tokens to transfer!");
        require(profileStorage.getStakeReserved(sender) >= amount, "Sender does not have enough tokens reserved to transfer!");

        profileStorage.setStakeReserved(sender, profileStorage.getStakeReserved(sender).sub(amount));
        profileStorage.setStake(sender, profileStorage.getStake(sender).sub(amount));
        profileStorage.setStake(receiver, profileStorage.getStake(receiver).add(amount));

        emit TokensTransferred(sender, receiver, amount);
    }

    function setMinimalStake(uint256 newMinimalStake) 
    public {
        require (msg.sender == hub.owner(), "Function can only be called by hub owner!");
        if(minimalStake != newMinimalStake) minimalStake = newMinimalStake;
    }

    function setWithdrawalTime(uint256 newWithdrawalTime) 
    public {
        require (msg.sender == hub.owner(), "Function can only be called by hub owner!");
        if(withdrawalTime != newWithdrawalTime) withdrawalTime = newWithdrawalTime;
    }
}
