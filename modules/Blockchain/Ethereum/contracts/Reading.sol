pragma solidity ^0.4.21;

library SafeMath {
	function mul(uint256 a, uint256 b) internal pure returns (uint256) {
		uint256 c = a * b;
		assert(a == 0 || c / a == b);
		return c;
	}

	function div(uint256 a, uint256 b) internal pure returns (uint256) {
		// assert(b > 0); // Solidity automatically throws when dividing by 0
		uint256 c = a / b;
		// assert(a == b * c + a % b); // There is no case in which this doesn't hold
		return c;
	}

	function sub(uint256 a, uint256 b) internal pure returns (uint256) {
		assert(b <= a);
		return a - b;
	}

	function add(uint256 a, uint256 b) internal pure returns (uint256) {
		uint256 c = a + b;
		assert(c >= a);
		return c;
	}
}

contract Bidding{
	function increaseBalance(address wallet, uint amount) public;
	function decreaseBalance(address wallet, uint amount) public;
	function getBalance(address wallet) public view returns (uint256);
}

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
 	address public owner;

 	event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

	/**
     * @dev The Ownable constructor sets the original `owner` of the contract to the sender
     * account.
     */
    function Ownable () public {
     	owner = msg.sender;
    }

	/**
     * @dev Throws if called by any account other than the owner.
     */
     modifier onlyOwner() {
     	require(msg.sender == owner);
     	_;
     }

	/**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
     function transferOwnership(address newOwner) public onlyOwner {
     	require(newOwner != address(0));
     	emit OwnershipTransferred(owner, newOwner);
     	owner = newOwner;
     }

 }

contract Reading is Ownable{
	using SafeMath for uint256;

	Bidding bidding;
	address escrow;

 	enum PurchaseStatus {inactive, initiated, verified, commited, confirmed, sent, paid, disputed}

	struct PurchaseDefinition{
 		uint token_amount;
 		uint stake_factor;

 		bytes32 commitment;
 		bytes32 encrypted_block;

 		uint256 time_of_sending;

 		PurchaseStatus purchase_status;
 	}

 	struct PurchasedDataDefinition {
 		address DC_wallet;
 		bytes32 distribution_root_hash;
 		uint256 checksum;
 	}

 	mapping(bytes32 => mapping(address => PurchasedDataDefinition)) public purchased_data;
 	mapping(address => mapping(address => mapping(bytes32 => PurchaseDefinition))) public purchase;

	event PurchaseInitiated(bytes32 import_id, address DH_wallet, address DV_wallet);
	event CommitmentSent(bytes32 import_id, address DH_wallet, address DV_wallet);
	event PurchaseConfirmed(bytes32 import_id, address DH_wallet, address DV_wallet);
	event EncryptedBlockSent(bytes32 import_id, address DH_wallet, address DV_wallet);
	event PurchaseDisputed(bytes32 import_id, address DH_wallet, address DV_wallet);

	function Reading(address escrow_address) 
	public {
		require(escrow_address != address(0));
		escrow = escrow_address;
	}

	function setBidding(address bidding_address)
	public onlyOwner {
		require(bidding_address != address(0));
		bidding = Bidding(bidding_address);
	}

	function addReadData (bytes32 import_id, address DH_wallet, address DC_wallet, bytes32 distribution_root_hash, uint checksum)
	public onlyOwner {
		PurchasedDataDefinition storage this_purchased_data = purchased_data[import_id][DH_wallet];

		this_purchased_data.DC_wallet = DC_wallet;
		this_purchased_data.distribution_root_hash = distribution_root_hash;
		this_purchased_data.checksum = checksum;
	}

	function removeReadData (bytes32 import_id, address DH_wallet)
	public onlyOwner {
		PurchasedDataDefinition storage this_purchased_data = purchased_data[import_id][DH_wallet];

		this_purchased_data.DC_wallet = address(0);
		this_purchased_data.distribution_root_hash = bytes32(0);
		this_purchased_data.checksum = 0;
	}	

	function initiatePurchase(bytes32 import_id, address DH_wallet, uint token_amount, uint stake_factor)
	public {
		PurchaseDefinition storage this_purchase = purchase[DH_wallet][msg.sender][import_id];
		require(this_purchase.purchase_status == PurchaseStatus.inactive);

		this_purchase.token_amount = token_amount;
		this_purchase.stake_factor = stake_factor;

		this_purchase.purchase_status = PurchaseStatus.initiated;
		emit PurchaseInitiated(import_id, DH_wallet, msg.sender);
	}

	function sendCommitment(bytes32 import_id, address DV_wallet, bytes32 commitment)
	public {
		PurchaseDefinition storage this_purchase = purchase[msg.sender][DV_wallet][import_id];
		require(this_purchase.purchase_status == PurchaseStatus.initiated);

		this_purchase.commitment = commitment;
		this_purchase.purchase_status = PurchaseStatus.commited;

		emit CommitmentSent(import_id, msg.sender, DV_wallet);
	}

	function confirmPurchase(bytes32 import_id, address DH_wallet)
	public {
		PurchaseDefinition storage this_purchase = purchase[DH_wallet][msg.sender][import_id];
		uint256 DV_balance = bidding.getBalance(msg.sender);
		require(this_purchase.purchase_status == PurchaseStatus.commited
			&& DV_balance > this_purchase.token_amount.add(SafeMath.mul(this_purchase.token_amount, this_purchase.stake_factor)));



		this_purchase.purchase_status = PurchaseStatus.confirmed;
		emit PurchaseConfirmed(import_id, DH_wallet, msg.sender);
	}

	function sendEncryptedBlock(bytes32 import_id, address DV_wallet, bytes32 encrypted_block)
	public {
		PurchaseDefinition storage this_purchase = purchase[msg.sender][DV_wallet][import_id];
		PurchasedDataDefinition storage this_purchased_data = purchased_data[import_id][DV_wallet];
		PurchasedDataDefinition storage previous_purchase = purchased_data[import_id][msg.sender];

		require(this_purchase.purchase_status == PurchaseStatus.confirmed);

		this_purchase.encrypted_block = encrypted_block;

		this_purchased_data.DC_wallet = previous_purchase.DC_wallet;
		this_purchased_data.distribution_root_hash = previous_purchase.distribution_root_hash;
		this_purchased_data.checksum = previous_purchase.checksum;

		this_purchase.time_of_sending = block.timestamp;

		this_purchase.purchase_status = PurchaseStatus.sent;
		emit EncryptedBlockSent(import_id, msg.sender, DV_wallet);
	}

	function payOut(bytes32 import_id, address DV_wallet)
	public {
		PurchaseDefinition storage this_purchase = purchase[msg.sender][DV_wallet][import_id];

		require(this_purchase.purchase_status == PurchaseStatus.sent
			&&  this_purchase.time_of_sending + 5 minutes < block.timestamp);

		bidding.increaseBalance(msg.sender, this_purchase.token_amount);
		bidding.increaseBalance(DV_wallet, this_purchase.token_amount.mul(this_purchase.stake_factor));

		this_purchase.purchase_status = PurchaseStatus.paid;
	}

	function initiateDispute(bytes32 import_id, address DH_wallet)
	public {
		PurchaseDefinition storage this_purchase = purchase[DH_wallet][msg.sender][import_id];

		require(this_purchase.purchase_status == PurchaseStatus.sent
			&&  this_purchase.time_of_sending + 5 minutes > block.timestamp);

		this_purchase.purchase_status = PurchaseStatus.disputed;
		emit PurchaseDisputed(import_id, DH_wallet, msg.sender);
	}

	function sendProofData(bytes32 import_id, address DV_wallet, uint256 checksum_left, uint256 checksum_right)
	public {
		PurchaseDefinition storage this_purchase = purchase[msg.sender][DV_wallet][import_id];

	}
}