pragma solidity ^0.4.24;

import {ERC20} from './TracToken.sol';
import './Hub.sol';

contract ProfileStorage {
    Hub public hub;
    
    constructor(address hubAddress) public {
        hub = Hub(hubAddress);
        activeNodes = 1;
    }
    
    modifier onlyProfile(){
        require(msg.sender == hub.profileAddress(),
        "Function can only be called by Profile contract!");
        _;
    }

    uint256 public activeNodes;

    function setActiveNodes(uint256 newActiveNodes) 
    public onlyProfile {
        activeNodes = newActiveNodes;
    }

    struct ProfileDefinition{
        uint256 stake;
        uint256 stakeReserved;
        uint256 reputation;
        bool withdrawalPending;
        uint256 withdrawalTimestamp;
        uint256 withdrawalAmount;
        bytes32 nodeId;
    }
    mapping(address => ProfileDefinition) public profile;

    function getStake(address identity) 
    public view returns(uint256) {
        return profile[identity].stake;
    }
    function getStakeReserved(address identity) 
    public view returns(uint256) {
        return profile[identity].stakeReserved;
    }
    function getReputation(address identity) 
    public view returns(uint256) {
        return profile[identity].reputation;
    }
    function getWithdrawalPending(address identity) 
    public view returns(bool) {
        return profile[identity].withdrawalPending;
    }
    function getWithdrawalTimestamp(address identity) 
    public view returns(uint256) {
        return profile[identity].withdrawalTimestamp;
    }
    function getWithdrawalAmount(address identity) 
    public view returns(uint256) {
        return profile[identity].withdrawalAmount;
    }
    function getNodeId(address identity) 
    public view returns(bytes32) {
        return profile[identity].nodeId;
    }
    
    function setStake(address identity, uint256 stake) 
    public onlyProfile {
        profile[identity].stake = stake;
    }
    function setStakeReserved(address identity, uint256 stakeReserved) 
    public onlyProfile {
        profile[identity].stakeReserved = stakeReserved;
    }
    function setReputation(address identity, uint256 reputation) 
    public onlyProfile {
        profile[identity].reputation = reputation;
    }
    function setWithdrawalPending(address identity, bool withdrawalPending) 
    public onlyProfile {
        profile[identity].withdrawalPending = withdrawalPending;
    }
    function setWithdrawalTimestamp(address identity, uint256 withdrawalTimestamp) 
    public onlyProfile {
        profile[identity].withdrawalTimestamp = withdrawalTimestamp;
    }
    function setWithdrawalAmount(address identity, uint256 withdrawalAmount) 
    public onlyProfile {
        profile[identity].withdrawalAmount = withdrawalAmount;
    }
    function setNodeId(address identity, bytes32 nodeId)
    public onlyProfile {
        profile[identity].nodeId = nodeId;
    }

    function transferTokens(address identity, uint256 amount)
    public onlyProfile {
        ERC20 token = ERC20(hub.tokenAddress());
        token.transfer(identity, amount);
    }
}
