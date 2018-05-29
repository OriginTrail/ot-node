pragem solidity ^0.4.23;


contract Reading{

	address escrow;

 	enum ReadingStatus {inactive, initiated, verified, commited, confirmed, sent}

	struct ReadingDefinition{
 		uint token_amount;
 		uint stake_factor;

 		bytes32 commitment;
 		bytes32 encrypted_block;

 		ReadingStatus reading_status;
 	}

 	mapping(address => mapping(address => mapping(bytes32 => ReadingDefinition))) public reading;

	event PurchaseInitiated(bytes32 import_id, address DH_wallet, address DV_wallet);
	event PurchaseVerified(bytes32 import_id, address DH_wallet, address DV_wallet);
	event CommitmentSent(bytes32 import_id, address DH_wallet, address DV_wallet);
	event PurchaseConfirmed(bytes32 import_id, address DH_wallet, address DV_wallet);
	event EncryptedBlockSent(bytes32 import_id, address DH_wallet, address DV_wallet);

	constructor(address escrow_address){
		escrow = escrow_address;
	}

	function initiatePurchase(bytes32 import_id, address DH_wallet, uint token_amount, uint stake_factor)
	public {
		ReadingDefinition this_reading = reading[DH_wallet][msg.sender][import_id];

		this_reading.token_amount = token_amount;
		this_reading.stake_factor = stake_factor;

		this_reading.reading_status = ReadingStatus.initiated;
		emit PurchaseInitiated(import_id, DH_wallet, msg.sender);
	}	

	function verifyPurchase(bytes32 import_id, address DV_wallet)
	public {
		ReadingDefinition this_reading = reading[msg.sender][DV_wallet][import_id];

		this_reading.reading_status = ReadingStatus.verified;
		emit PurchaseVerified(import_id, msg.sender, DV_wallet);
	}

	function sendCommitment(bytes32 import_id, address DV_wallet, bytes32 commitment)
	public {
		ReadingDefinition this_reading = reading[msg.sender][DV_wallet][import_id];

		this_reading.commitment = commitment
		this_reading.reading_status = ReadingStatus.commited;
		emit CommitmentSent(import_id, msg.sender, DV_wallet);
	}

	function confirmPurchase(bytes32 import_id, address DH_wallet)
	public {
		ReadingDefinition this_reading = reading[DH_wallet][msg.sender][import_id];

		this_reading.reading_status = ReadingStatus.confirmed;
		emit PurchaseConfirmed(import_id, DH_wallet, msg.sender);
	}

	function sendEncryptedBlock(bytes32 import_id, address DV_wallet, bytes32 encrypted_block)
	public {
		ReadingDefinition this_reading = reading[msg.sender][DV_wallet][import_id];

		this_reading.encrypted_block = encrypted_block;

		this_reading.reading_status = ReadingStatus.sent;
		emit EncryptedBlockSent(import_id, msg.sender, DV_wallet);
	}

}