pragma solidity ^0.4.23;

import {SafeMath} from './SafeMath.sol';
import {ProfileStorage} from './ProfileStorage.sol';
import {Hub} from './Hub.sol';
import {ERC725, Identity} from './Identity.sol';
import {ERC20} from './TracToken.sol';

contract Profile {
    using SafeMath for uint256;
    Hub public hub;
    ProfileStorage public profileStorage;

    uint256 public minimalStake = 10**20; // TODO Determine minimum stake
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
    
    event WithdrawalIntitiated(address profile, uint256 amount, uint256 withdrawalReadyAt);
    event TokenWithdrawalCancelled(address profile);
    event TokensWithdrawn(address profile, uint256 amounWithdrawn, uint256 newBalance);
    
    function createProfile(bytes32 profileNodeId, uint256 initialBalance, bool senderIs725) public {
        ERC20 tokenContract = ERC20(hub.tokenAddress());
        require(tokenContract.allowance(msg.sender, this) >= initialBalance, "Sender allowance must be equal to or higher than initial balance");
        require(tokenContract.balanceOf(msg.sender) >= initialBalance, "Sender balance must be equal to or higher than initial balance!");

        tokenContract.transferFrom(msg.sender, address(profileStorage), initialBalance);

        if(!senderIs725) {
            Identity newIdentity = new Identity(msg.sender);
            emit IdentityCreated(msg.sender, address(newIdentity));

            profileStorage.setStake(address(newIdentity), initialBalance);
            profileStorage.setNodeId(address(newIdentity), profileNodeId);
        }
        else {
            profileStorage.setStake(msg.sender, initialBalance);
            profileStorage.setNodeId(msg.sender, profileNodeId);
        }

        if(initialBalance > minimalStake) {
            uint256 activeNodes = profileStorage.activeNodes();
            activeNodes += 1;
            profileStorage.setActiveNodes(activeNodes);
        }
    }

    function depositTokens(uint256 amount) public {
        ERC20 tokenContract = ERC20(hub.tokenAddress());
        require(tokenContract.allowance(msg.sender, this) >= amount, "Sender allowance must be equal to or higher than chosen amount");
        require(tokenContract.balanceOf(msg.sender) >= amount, "Sender balance must be equal to or higher than chosen amount!");

        tokenContract.transferFrom(msg.sender, address(profileStorage), amount);

        uint256 balance = profileStorage.getStake(msg.sender);
        balance = balance.add(amount);
        profileStorage.setStake(msg.sender, balance);

        emit TokensDeposited(msg.sender, amount, balance);
    }

    function startTokenWithdrawal(uint256 amount) public {
        if(profileStorage.getWithdrawalPending(msg.sender)){
            if(block.timestamp < profileStorage.getWithdrawalTimestamp(msg.sender)){
                // Transfer already reserved tokens to user identity
                profileStorage.transferTokens(msg.sender, profileStorage.getWithdrawalAmount(msg.sender));
                
                uint256 balance = profileStorage.getStake(msg.sender);
                balance = balance.sub(profileStorage.getWithdrawalAmount(msg.sender));
                profileStorage.setStake(msg.sender, balance);
                
                emit TokensWithdrawn(msg.sender, profileStorage.getWithdrawalAmount(msg.sender), balance);
            }
            else {
                require(false, "Withrdrawal process already pending!");
            }
        }

        uint256 availableBalance = profileStorage.getStake(msg.sender).sub(profileStorage.getStakeReserved(msg.sender));

        
        profileStorage.setWithdrawalPending(msg.sender, true);
        profileStorage.setWithdrawalTimestamp(msg.sender, block.timestamp + withdrawalTime);
        if(availableBalance >= amount) {
            // Reserve chosen token amount
            profileStorage.setWithdrawalAmount(msg.sender, amount);
            emit WithdrawalIntitiated(msg.sender, amount, block.timestamp + withdrawalTime);
        }
        else {
            // Reserve only the available balance
            profileStorage.setWithdrawalAmount(msg.sender, availableBalance);
            emit WithdrawalIntitiated(msg.sender, availableBalance, block.timestamp + withdrawalTime);
        }
    }

    function withdrawTokens() public {
        require(profileStorage.getWithdrawalPending(msg.sender), "Cannot withdraw tokens before starting token withdrawal!");
        require(block.timestamp < profileStorage.getWithdrawalTimestamp(msg.sender), "Cannot withdraw tokens before withdrawal timestamp!");

        // Transfer already reserved tokens to user identity
        profileStorage.transferTokens(msg.sender, profileStorage.getWithdrawalAmount(msg.sender));
        
        uint256 balance = profileStorage.getStake(msg.sender);
        balance = balance.sub(profileStorage.getWithdrawalAmount(msg.sender));
        profileStorage.setStake(msg.sender, balance);

        profileStorage.setWithdrawalPending(msg.sender, false);
        
        emit TokensWithdrawn(msg.sender, profileStorage.getWithdrawalAmount(msg.sender), balance);
    }
    
    function reserveTokens(address identity1, address identity2, address identity3, uint256 amount) 
    public onlyHolding {
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

        require(minimalStake <= profileStorage.getStake(identity1).sub(profileStorage.getStakeReserved(identity1)).sub(amount), 
            "Profile does not have enough stake for reserving!");
        require(minimalStake <= profileStorage.getStake(identity2).sub(profileStorage.getStakeReserved(identity2)).sub(amount), 
            "Profile does not have enough stake for reserving!");
        require(minimalStake <= profileStorage.getStake(identity3).sub(profileStorage.getStakeReserved(identity3)).sub(amount), 
            "Profile does not have enough stake for reserving!");

        uint256 stakeReserved = profileStorage.getStakeReserved(identity1);
        stakeReserved = stakeReserved.add(amount);
        profileStorage.setStakeReserved(identity1, stakeReserved);

        stakeReserved = profileStorage.getStakeReserved(identity2);
        stakeReserved = stakeReserved.add(amount);
        profileStorage.setStakeReserved(identity2, stakeReserved);

        stakeReserved = profileStorage.getStakeReserved(identity3);
        stakeReserved = stakeReserved.add(amount);
        profileStorage.setStakeReserved(identity3, stakeReserved);

        emit TokensReserved(identity1, amount);
        emit TokensReserved(identity2, amount);
        emit TokensReserved(identity3, amount);
    }
}
