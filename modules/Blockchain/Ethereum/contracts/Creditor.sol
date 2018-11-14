pragma solidity ^0.4.23;

import './TracToken.sol';
import {Hub} from './Hub.sol';

contract Creditor is Ownable {
    using SafeMath for uint256;
	
	Hub public hub;
	mapping (address => uint256) internal allowed;
	event Approval(address indexed spender, uint256 value);

	constructor(address hubAddress) public {
        hub = Hub(hubAddress);
	}

	/**
	 * @dev Function to check the amount of tokens that the creditor allowed to a spender.
	 * @param _spender address The address which will spend the funds.
	 * @return A uint256 specifying the amount of tokens still available for the spender.
	 */
	function allowance(address _spender) public constant returns (uint256 remaining) {
		return allowed[_spender];
	}

	function increaseApproval (address _spender, uint _addedValue) onlyOwner public returns (bool success) {
		// Allow holding to transfer tokens from this contract
		TracToken(hub.tokenAddress()).increaseApproval(hub.holdingAddress(), _addedValue);
		
		// Increase allowance for a specific spender
		allowed[_spender] = allowed[_spender].add(_addedValue);

		emit Approval(_spender, allowed[_spender]);
		return true;
	}

	function decreaseApproval (address _spender, uint _subtractedValue) public returns (bool success) {
		require(hub.isContract(msg.sender));

		uint oldValue = allowed[_spender];
		require (oldValue >= _subtractedValue);
		
		allowed[_spender] = oldValue.sub(_subtractedValue);
		
		emit Approval(_spender, allowed[_spender]);
		return true;
	}

    function withdrawApproval (address _spender, uint _subtractedValue) onlyOwner public returns (bool success) {
        uint oldValue = allowed[_spender];
        require (oldValue >= _subtractedValue);

        allowed[_spender] = oldValue.sub(_subtractedValue);
        TracToken(hub.tokenAddress()).decreaseApproval(hub.holdingAddress(), _subtractedValue);
        TracToken(hub.tokenAddress()).transfer(msg.sender, _subtractedValue);

        emit Approval(_spender, allowed[_spender]);
        return true;
    }

}