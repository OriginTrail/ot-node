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
	 * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
	 *
	 * Beware that changing an allowance with this method brings the risk that someone may use both the old
	 * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
	 * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
	 * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
	 * @param _spender The address which will spend the funds.
	 * @param _value The amount of tokens to be spent.
	 */
	function approve(address _spender, uint256 _value) onlyOwner public returns (bool) {
		// mitigating the race condition
		require(allowed[_spender] == 0 || _value == 0);
		TracToken(hub.tokenAddress()).approve(_spender, _value);
		allowed[_spender] = _value;
		emit Approval(_spender, _value);
		return true;
	}

	/**
	 * @dev Function to check the amount of tokens that an owner allowed to a spender.
	 * @param _spender address The address which will spend the funds.
	 * @return A uint256 specifying the amount of tokens still available for the spender.
	 */
	function allowance(address _spender) public constant returns (uint256 remaining) {
		return allowed[_spender];
	}

	/**
	 * approve should be called when allowed[_spender] == 0. To increment
	 * allowed value is better to use this function to avoid 2 calls (and wait until
	 * the first transaction is mined)
	 * From MonolithDAO Token.sol
	 */
	function increaseApproval (address _spender, uint _addedValue) onlyOwner public returns (bool success) {
		TracToken(hub.tokenAddress()).increaseApproval(hub.holdingAddress(), _addedValue);
		allowed[_spender] = allowed[_spender].add(_addedValue);
		emit Approval(_spender, allowed[_spender]);
		return true;
	}

	function decreaseApproval (address _spender, uint _subtractedValue) public returns (bool success) {
		require(msg.sender == owner || hub.isContract(msg.sender));

		uint oldValue = allowed[_spender];
		require (oldValue > _subtractedValue);
		
		allowed[_spender] = oldValue.sub(_subtractedValue);
		
		emit Approval(_spender, allowed[msg.sender]);
		return true;
	}

}