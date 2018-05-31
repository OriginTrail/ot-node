pragma solidity ^0.4.21;

contract Reading{

	address escrow;

	modifier onlyEscrow() {
		require(msg.sender == escrow);
		_;
	}

 	enum ReadingStatus {inactive, initiated, verified, commited, confirmed, sent}

	struct ReadingDefinition{
 		uint token_amount;
 		uint stake_factor;

 		bytes32 commitment;
 		bytes32 encrypted_block;

 		ReadingStatus reading_status;
 	}

 	struct PurchaseDefinition {
 		address DC_wallet;
 		bytes32 data_root_hash;
 		uint256 checksum;
 	}

 	mapping(bytes32 => mapping(address => PurchaseDefinition)) public purchased_data;
 	mapping(address => mapping(address => mapping(bytes32 => ReadingDefinition))) public reading;

	event PurchaseInitiated(bytes32 import_id, address DH_wallet, address DV_wallet);
	event PurchaseVerified(bytes32 import_id, address DH_wallet, address DV_wallet);
	event CommitmentSent(bytes32 import_id, address DH_wallet, address DV_wallet);
	event PurchaseConfirmed(bytes32 import_id, address DH_wallet, address DV_wallet);
	event EncryptedBlockSent(bytes32 import_id, address DH_wallet, address DV_wallet);

	function Reading(address escrow_address)
	public {
		require(escrow_address != address(0));
		escrow = escrow_address;
	}

	function addReadData (bytes32 import_id, address DH_wallet, address DC_wallet, bytes32 data_root_hash, uint checksum)
	public onlyEscrow {
		PurchaseDefinition storage this_purchase = purchased_data[import_id][DH_wallet];

		this_purchase.DC_wallet = DC_wallet;
		this_purchase.data_root_hash = data_root_hash;
		this_purchase.checksum = checksum;
	}

	function removeReadData (bytes32 import_id, address DH_wallet)
	public onlyEscrow {
		PurchaseDefinition storage this_purchase = purchased_data[import_id][DH_wallet];

		this_purchase.DC_wallet = address(0);
		this_purchase.data_root_hash = bytes32(0);
		this_purchase.checksum = 0;
	}	

	function initiatePurchase(bytes32 import_id, address DH_wallet, uint token_amount, uint stake_factor)
	public {
		ReadingDefinition storage this_reading = reading[DH_wallet][msg.sender][import_id];

		this_reading.token_amount = token_amount;
		this_reading.stake_factor = stake_factor;

		this_reading.reading_status = ReadingStatus.initiated;
		emit PurchaseInitiated(import_id, DH_wallet, msg.sender);
	}	

	function verifyPurchase(bytes32 import_id, address DV_wallet)
	public {
		ReadingDefinition storage this_reading = reading[msg.sender][DV_wallet][import_id];

		this_reading.reading_status = ReadingStatus.verified;
		emit PurchaseVerified(import_id, msg.sender, DV_wallet);
	}

	function sendCommitment(bytes32 import_id, address DV_wallet, bytes32 commitment)
	public {
		ReadingDefinition storage this_reading = reading[msg.sender][DV_wallet][import_id];

		this_reading.commitment = commitment;
		this_reading.reading_status = ReadingStatus.commited;
		emit CommitmentSent(import_id, msg.sender, DV_wallet);
	}

	function confirmPurchase(bytes32 import_id, address DH_wallet)
	public {
		ReadingDefinition storage this_reading = reading[DH_wallet][msg.sender][import_id];

		this_reading.reading_status = ReadingStatus.confirmed;
		emit PurchaseConfirmed(import_id, DH_wallet, msg.sender);
	}

	function sendEncryptedBlock(bytes32 import_id, address DV_wallet, bytes32 encrypted_block)
	public {
		ReadingDefinition storage this_reading = reading[msg.sender][DV_wallet][import_id];
		PurchaseDefinition storage this_purchase = purchased_data[import_id][DV_wallet];
		PurchaseDefinition storage previous_purchase = purchased_data[import_id][msg.sender];

		this_reading.encrypted_block = encrypted_block;

		this_purchase.DC_wallet = msg.sender;
		this_purchase.data_root_hash = previous_purchase.data_root_hash;
		this_purchase.checksum = previous_purchase.checksum;

		this_reading.reading_status = ReadingStatus.sent;
		emit EncryptedBlockSent(import_id, msg.sender, DV_wallet);
	}
}