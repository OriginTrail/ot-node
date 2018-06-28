pragma solidity ^0.4.18;

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

contract ERC20Basic {
	uint256 public totalSupply;
	function balanceOf(address who) public constant returns (uint256);
	function transfer(address to, uint256 value) public returns (bool);
	event Transfer(address indexed from, address indexed to, uint256 value);
}

contract ERC20 is ERC20Basic {
	function allowance(address owner, address spender) public constant returns (uint256);
	function transferFrom(address from, address to, uint256 value) public returns (bool);
	function approve(address spender, uint256 value) public returns (bool);
	event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract EscrowHolder {
	function initiateEscrow(address DC_wallet, address DH_wallet, bytes32 import_id, uint token_amount, uint stake_amount, uint total_time_in_minutes) public;
}

contract Bidding{
	using SafeMath for uint256;

	ERC20 public token;
	EscrowHolder public escrow;
	address public reading;

	modifier onlyContracts() {
		require(EscrowHolder(msg.sender) == escrow || msg.sender == reading);
		_;
	}
	
	function Bidding(address token_address, address escrow_address, address reading_address)
	public{
		require ( token_address != address(0) && escrow_address != address(0) && reading_address != address(0));
		token = ERC20(token_address);
		escrow = EscrowHolder(escrow_address);
		reading = reading_address;
		active_nodes = 0;
	}


	/*    ----------------------------- BIDDING -----------------------------     */


	struct OfferDefinition{
		address DC_wallet;

		//Parameters for DH filtering
		uint max_token_amount_per_DH;
		uint min_stake_amount_per_DH; 
		uint min_reputation;

		//Data holding parameters
		uint total_escrow_time_in_minutes;
		uint data_size_in_bytes;

		//Parameters for the bidding ranking
		bytes32 data_hash;
		uint first_bid_index;

		uint replication_factor;

		bool active;
		bool finalized;

		// uint256 offer_creation_timestamp;

		BidDefinition[] bid;
	}

	struct ProfileDefinition{
		//Offer Parameters
		uint token_amount_per_byte_minute; //Per byte per minute
		uint stake_amount_per_byte_minute; //Per byte per minute

		uint read_stake_factor;

		uint balance;
		uint reputation;
		uint number_of_escrows;

		uint max_escrow_time_in_minutes;

		bool active;
	}

	struct BidDefinition{
		address DH_wallet;
		bytes32 DH_node_id;

		uint token_amount_for_escrow;
		uint stake_amount_for_escrow;

		uint256 distance;

		uint next_bid;

		bool active;
		bool chosen;
	}

	uint256 public active_nodes;
	mapping(bytes32 => OfferDefinition) public offer; //offer[import_id] import_id
	mapping(address => ProfileDefinition) public profile; //profile[wallet]

	event OfferCreated(bytes32 import_id, bytes32 DC_node_id, uint total_escrow_time_in_minutes, uint max_token_amount_per_DH, uint min_stake_amount_per_DH, uint min_reputation, uint data_size_in_bytes, bytes32 data_hash);
	event OfferCanceled(bytes32 import_id);
	event AddedBid(bytes32 import_id, address DH_wallet, bytes32 DH_node_id, uint bid_index);
	event AddedPredeterminedBid(bytes32 import_id, address DH_wallet, bytes32 DH_node_id, uint bid_index, uint total_escrow_time_in_minutes, uint max_token_amount_per_DH, uint min_stake_amount_per_DH, uint data_size_in_bytes);
	event FinalizeOfferReady(bytes32 import_id);
	event BidTaken(bytes32 import_id, address DH_wallet);
	event OfferFinalized(bytes32 import_id);

	/*    ----------------------------- OFFERS -----------------------------     */

	function createOffer(
		bytes32 import_id,
		bytes32 DC_node_id,

		uint total_escrow_time_in_minutes, 
		uint max_token_amount_per_DH,
		uint min_stake_amount_per_DH,
		uint min_reputation,

		bytes32 data_hash,
		uint data_size_in_bytes,

		address[] predetermined_DH_wallet,
		bytes32[] predetermined_DH_node_id)
	public {
		OfferDefinition storage this_offer = offer[import_id];

		require(max_token_amount_per_DH > 0 && total_escrow_time_in_minutes > 0 && data_size_in_bytes > 0);
		require(this_offer.active == false);

		require(profile[msg.sender].balance >= max_token_amount_per_DH.mul(predetermined_DH_wallet.length.mul(2).add(1)));
		profile[msg.sender].balance = profile[msg.sender].balance.sub(max_token_amount_per_DH.mul(predetermined_DH_wallet.length.mul(2).add(1)));
		emit BalanceModified(msg.sender, profile[msg.sender].balance);

		this_offer.DC_wallet = msg.sender;

		this_offer.total_escrow_time_in_minutes = total_escrow_time_in_minutes;
		this_offer.max_token_amount_per_DH = max_token_amount_per_DH;
		this_offer.min_stake_amount_per_DH = min_stake_amount_per_DH;
		this_offer.min_reputation = min_reputation;

		this_offer.data_hash = data_hash;
		this_offer.data_size_in_bytes = data_size_in_bytes;

		this_offer.replication_factor = predetermined_DH_wallet.length;

		this_offer.active = true;
		this_offer.finalized = false;

		this_offer.first_bid_index = uint(-1);
		// this_offer.offer_creation_timestamp = block.timestamp;

		//Writing the predetermined DC into the bid list
		while(this_offer.bid.length < predetermined_DH_wallet.length) {
			BidDefinition memory bid_def = BidDefinition(predetermined_DH_wallet[this_offer.bid.length], predetermined_DH_node_id[this_offer.bid.length], 0, 0, 0, 0, false, false);
			this_offer.bid.push(bid_def);
			emit AddedPredeterminedBid(import_id, bid_def.DH_wallet, bid_def.DH_node_id, this_offer.bid.length - 1, total_escrow_time_in_minutes, max_token_amount_per_DH, min_stake_amount_per_DH, data_size_in_bytes);
		}

		emit OfferCreated(import_id, DC_node_id, total_escrow_time_in_minutes, max_token_amount_per_DH, min_stake_amount_per_DH, min_reputation, data_size_in_bytes, data_hash);
	}

	//TODO Decide when and under which conditions DC can cancel an offer
	function cancelOffer(bytes32 import_id)
	public{
		OfferDefinition storage this_offer = offer[import_id];
		require(this_offer.active && this_offer.DC_wallet == msg.sender
			&& this_offer.finalized == false);
		this_offer.active = false;
		uint max_total_token_amount = this_offer.max_token_amount_per_DH.mul(this_offer.replication_factor.mul(2).add(1));
		profile[msg.sender].balance = profile[msg.sender].balance.add(max_total_token_amount);
		emit BalanceModified(msg.sender, profile[msg.sender].balance);
		emit OfferCanceled(import_id);
	}

	function activatePredeterminedBid(bytes32 import_id, bytes32 DH_node_id, uint bid_index)
	public{
		require(offer[import_id].active && !offer[import_id].finalized);

		OfferDefinition storage this_offer = offer[import_id];
		ProfileDefinition storage this_DH = profile[msg.sender];
		BidDefinition storage this_bid = offer[import_id].bid[bid_index];

		require(this_bid.DH_wallet == msg.sender && this_bid.DH_node_id == DH_node_id);

		//Check if the the DH meets the filters DC set for the offer
		uint scope = this_offer.data_size_in_bytes * this_offer.total_escrow_time_in_minutes;
		require(this_offer.total_escrow_time_in_minutes <= this_DH.max_escrow_time_in_minutes);
		require(this_offer.max_token_amount_per_DH  >= this_DH.token_amount_per_byte_minute * scope);
		require((this_offer.min_stake_amount_per_DH  <= this_DH.stake_amount_per_byte_minute * scope) && (this_DH.stake_amount_per_byte_minute * scope <= profile[msg.sender].balance));

		//Write the required data for the bid
		this_bid.token_amount_for_escrow = this_DH.token_amount_per_byte_minute * scope;
		this_bid.stake_amount_for_escrow = this_DH.stake_amount_per_byte_minute * scope;
		this_bid.active = true;
	}

	function getDistanceParameters(bytes32 import_id)
	public view returns (bytes32 node_hash, bytes32 data_hash, uint256 distance, uint256 current_ranking, uint256 required_bid_amount, uint256 active_nodes_){
		OfferDefinition storage this_offer = offer[import_id];

		node_hash = bytes32(uint128(keccak256(msg.sender)));
		data_hash = bytes32(uint128(this_offer.data_hash));


		distance = calculateDistance(import_id, msg.sender);
		required_bid_amount = this_offer.replication_factor.mul(2).add(1);
		active_nodes_ = active_nodes;

		if(this_offer.first_bid_index == uint(-1)){
			current_ranking = 0;
		}
		else{
			uint256 current_index = this_offer.first_bid_index;
			current_ranking = 0;
			while(this_offer.bid[current_index].next_bid != uint(-1) && this_offer.bid[current_index].distance >= distance){
				current_index = this_offer.bid[current_index].next_bid;
				current_ranking++;
			}
		}
	}

	function addBid(bytes32 import_id, bytes32 DH_node_id)
	public returns (uint distance){
		require(offer[import_id].active && !offer[import_id].finalized);

		OfferDefinition storage this_offer = offer[import_id];
		ProfileDefinition storage this_DH = profile[msg.sender];

		//Check if the the DH meets the filters DC set for the offer
		uint scope = this_offer.data_size_in_bytes * this_offer.total_escrow_time_in_minutes;
		require(this_offer.total_escrow_time_in_minutes <= this_DH.max_escrow_time_in_minutes);
		require(this_offer.max_token_amount_per_DH  >= this_DH.token_amount_per_byte_minute * scope);
		require((this_offer.min_stake_amount_per_DH  <= this_DH.stake_amount_per_byte_minute * scope) && (this_DH.stake_amount_per_byte_minute * scope <= profile[msg.sender].balance));
		require(this_offer.min_reputation 	 <= profile[msg.sender].reputation);

		//Create new bid in the list
		uint this_bid_index = this_offer.bid.length;
		BidDefinition memory new_bid = BidDefinition(msg.sender, DH_node_id, this_DH.token_amount_per_byte_minute * scope, this_DH.stake_amount_per_byte_minute * scope, 0, uint(-1), true, false);
		new_bid.distance = calculateDistance(import_id, msg.sender);

		distance = new_bid.distance;

		//Insert the bid in the proper place in the list
		if(this_offer.first_bid_index == uint(-1)){
			this_offer.first_bid_index = this_bid_index;
			this_offer.bid.push(new_bid);
		}
		else{
			uint256 current_index = this_offer.first_bid_index;
			uint256 previous_index = uint(-1);
			if(this_offer.bid[current_index].distance < new_bid.distance){
				this_offer.first_bid_index = this_bid_index;
				new_bid.next_bid = current_index;
				this_offer.bid.push(new_bid);
			}
			else {
				while(current_index != uint(-1) && this_offer.bid[current_index].distance >= new_bid.distance){
					previous_index = current_index;
					current_index = this_offer.bid[current_index].next_bid;
				}
				if(current_index == uint(-1)){
					this_offer.bid[previous_index].next_bid = this_bid_index;
					this_offer.bid.push(new_bid);
				}
				else{
					new_bid.next_bid = current_index;
					this_offer.bid[previous_index].next_bid = this_bid_index;
					this_offer.bid.push(new_bid);
				}
			}
		}

		if(this_offer.bid.length >= this_offer.replication_factor.mul(3).add(1)) emit FinalizeOfferReady(import_id);

		emit AddedBid(import_id, msg.sender, DH_node_id, this_bid_index);
		// return this_bid_index;
	}

	function getBidIndex(bytes32 import_id, bytes32 DH_node_id) public view returns(uint){
		OfferDefinition storage this_offer = offer[import_id];
		uint256 i = 0;
		while(i < this_offer.bid.length && (offer[import_id].bid[i].DH_wallet != msg.sender || offer[import_id].bid[i].DH_node_id != DH_node_id)) i = i + 1;
		if( i == this_offer.bid.length) return uint(-1);
		else return i;
	}

	function cancelBid(bytes32 import_id, uint bid_index)
	public{
		require(offer[import_id].bid[bid_index].DH_wallet == msg.sender);
		offer[import_id].bid[bid_index].active = false;
	}

	function chooseBids(bytes32 import_id) public returns (uint256[] chosen_data_holders){

		OfferDefinition storage this_offer = offer[import_id];
		require(this_offer.active && !this_offer.finalized);
		require(this_offer.replication_factor.mul(3).add(1) <= this_offer.bid.length);
		// require(this_offer.offer_creation_timestamp + 5 minutes < block.timestamp);
		
		chosen_data_holders = new uint256[](this_offer.replication_factor.mul(2).add(1));

		uint256 i;
		uint256 current_index = 0;

		uint256 token_amount_sent = 0;
		uint256 max_total_token_amount = this_offer.max_token_amount_per_DH.mul(this_offer.replication_factor.mul(2).add(1));

		//Sending escrow requests to predetermined bids
		for(i = 0; i < this_offer.replication_factor; i = i + 1){
			BidDefinition storage chosen_bid = this_offer.bid[i];
			ProfileDefinition storage chosen_DH = profile[chosen_bid.DH_wallet];				

			if(profile[chosen_bid.DH_wallet].balance >= chosen_bid.stake_amount_for_escrow && chosen_bid.active){
				//Initiating new escrow
				escrow.initiateEscrow(msg.sender, chosen_bid.DH_wallet, import_id, chosen_bid.token_amount_for_escrow, chosen_bid.stake_amount_for_escrow, this_offer.total_escrow_time_in_minutes);

				token_amount_sent = token_amount_sent.add(chosen_bid.token_amount_for_escrow);

				chosen_bid.chosen = true;
				chosen_data_holders[current_index] = i;
				current_index = current_index + 1;

				emit BidTaken(import_id, chosen_bid.DH_wallet);
			}
		}		

		//Sending escrow requests to network bids
		uint256 bid_index = this_offer.first_bid_index;
		while(current_index < this_offer.replication_factor.mul(2).add(1)) {

			while(bid_index != uint(-1) && !this_offer.bid[bid_index].active){
				bid_index = this_offer.bid[bid_index].next_bid;
			} 
			if(bid_index == uint(-1)) break;

			chosen_bid = this_offer.bid[bid_index];
			chosen_DH = profile[chosen_bid.DH_wallet];

			if(profile[chosen_bid.DH_wallet].balance >= chosen_bid.stake_amount_for_escrow){
				//Initiating new escrow
				escrow.initiateEscrow(msg.sender, chosen_bid.DH_wallet, import_id, chosen_bid.token_amount_for_escrow, chosen_bid.stake_amount_for_escrow, this_offer.total_escrow_time_in_minutes);

				token_amount_sent = token_amount_sent.add(chosen_bid.token_amount_for_escrow);

				chosen_bid.chosen = true;
				chosen_data_holders[current_index] = bid_index;
				current_index = current_index + 1;
				bid_index = this_offer.bid[bid_index].next_bid;

				emit BidTaken(import_id, chosen_bid.DH_wallet);
			}
			else{
				chosen_bid.active = false;
			}
		}

		offer[import_id].finalized = true;

		profile[msg.sender].balance = profile[msg.sender].balance.add(max_total_token_amount.sub(token_amount_sent));
		emit BalanceModified(msg.sender, profile[msg.sender].balance);
		emit OfferFinalized(import_id); 
	}


	function isBidChosen(bytes32 import_id, uint bid_index) public constant returns (bool _isBidChosen){
		return offer[import_id].bid[bid_index].chosen;
	}

	function getOfferStatus(bytes32 import_id) public constant returns (bool isOfferFinal){
		return offer[import_id].finalized;
	}

	/*    ----------------------------- PROFILE -----------------------------    */

	event ProfileCreated(address wallet, bytes32 node_id);
	event BalanceModified(address wallet, uint new_balance);
	event ReputationModified(address wallet, uint new_balance);

	function createProfile(bytes32 node_id, uint price_per_byte_minute, uint stake_per_byte_minute, uint read_stake_factor, uint max_time_in_minutes) public{
		ProfileDefinition storage this_profile = profile[msg.sender];
		require(!this_profile.active);
		this_profile.active = true;
		active_nodes = active_nodes.add(1);

		this_profile.token_amount_per_byte_minute = price_per_byte_minute;
		this_profile.stake_amount_per_byte_minute = stake_per_byte_minute;

		this_profile.read_stake_factor = read_stake_factor;
		this_profile.max_escrow_time_in_minutes = max_time_in_minutes;

		emit ProfileCreated(msg.sender, node_id);
	}

	function setPrice(uint new_price_per_byte_minute) public {
		profile[msg.sender].token_amount_per_byte_minute = new_price_per_byte_minute;
	}

	function setStake(uint new_stake_per_byte_minute) public {
		profile[msg.sender].stake_amount_per_byte_minute = new_stake_per_byte_minute;
	}

	function setMaxTime(uint new_max_time_in_minutes) public {
		profile[msg.sender].max_escrow_time_in_minutes = new_max_time_in_minutes;
	}

	function depositToken(uint amount) public {
		require(token.balanceOf(msg.sender) >= amount && token.allowance(msg.sender, this) >= amount);
		uint amount_to_transfer = amount;
		amount = 0;
		if(amount_to_transfer > 0) {
			token.transferFrom(msg.sender, this, amount_to_transfer);
			profile[msg.sender].balance = profile[msg.sender].balance.add(amount_to_transfer);
			emit BalanceModified(msg.sender, profile[msg.sender].balance);
		}
	}

	function withdrawToken(uint amount) public {
		uint256 amount_to_transfer;
		if(profile[msg.sender].balance >= amount){
			amount_to_transfer = amount;
			profile[msg.sender].balance = profile[msg.sender].balance.sub(amount);
		}
		else{ 
			amount_to_transfer = profile[msg.sender].balance;
			profile[msg.sender].balance = 0;
		}
		amount = 0;
		if(amount_to_transfer > 0){
			token.transfer(msg.sender, amount_to_transfer);
			emit BalanceModified(msg.sender, profile[msg.sender].balance);
		} 
	}

	function increaseBalance(address wallet, uint amount) public onlyContracts {
		profile[wallet].balance = profile[wallet].balance.add(amount);
		emit BalanceModified(wallet, profile[wallet].balance);
	}

	function decreaseBalance(address wallet, uint amount) public onlyContracts {
		require(profile[wallet].balance >= amount);
		profile[wallet].balance = profile[wallet].balance.sub(amount);
		emit BalanceModified(wallet, profile[wallet].balance);
	}

	function increaseReputation(address wallet, uint amount) public onlyContracts {
		profile[wallet].reputation = profile[wallet].reputation.add(amount);
		emit ReputationModified(wallet, profile[wallet].reputation);
	}

	function addEscrow(address wallet) public onlyContracts {
		profile[wallet].number_of_escrows = profile[wallet].number_of_escrows.add(1);
	}

	function getBalance(address wallet)
	public view returns (uint256) {
		return profile[wallet].balance;
	}

	function getReadStakeFactor(address wallet)
	public view returns (uint256) {
		return profile[wallet].read_stake_factor;
	}

	function absoluteDifference(uint256 a, uint256 b) public pure returns (uint256) {
		if (a > b) return a-b;
		else return b-a;
	}

	function log2(uint x) internal pure returns (uint y){
		require(x > 0);
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

	
	// corrective_factor = 10^10;
	// DH_stake = 10^20
	// min_stake_amount_per_DH = 10^18
	// data_hash = 1234567890
	// DH_node_id = 123456789011
	// max_token_amount_per_DH = 100000000
	// token_amount = 10000
	// min_reputation = 10
	// reputation = 60
	// hash_difference = abs(data_hash - DH_node_id)
	// hash_f = (data_hash * (2^128)) / (hash_difference + data_hash)
	// price_f = corrective_factor - ((corrective_factor * token_amount) / max_token_amount_per_DH)
	// stake_f = (corrective_factor - ((min_stake_amount_per_DH * corrective_factor) / DH_stake)) * data_hash / (hash_difference + data_hash)
	// rep_f = (corrective_factor - (min_reputation * corrective_factor / reputation))
	// distance = ((hash_f * (corrective_factor + price_f + stake_`f + rep_f)) / 4) / corrective_factor 

	// Constant values used for distance calculation
	uint256 corrective_factor = 10**10;

	function calculateDistance(bytes32 import_id, address DH_wallet)
	public view returns (uint256 distance) {
		OfferDefinition storage this_offer = offer[import_id];
		ProfileDefinition storage this_DH = profile[DH_wallet];

		uint256 stake_amount;
		if (this_DH.stake_amount_per_byte_minute == 0) stake_amount = 1;
		else stake_amount = this_DH.stake_amount_per_byte_minute * this_offer.total_escrow_time_in_minutes.mul(this_offer.data_size_in_bytes);
		uint256 token_amount = this_DH.token_amount_per_byte_minute * this_offer.total_escrow_time_in_minutes.mul(this_offer.data_size_in_bytes);

		uint256 reputation;
		if(this_DH.number_of_escrows == 0 || this_DH.reputation == 0) reputation = 1;
		else reputation = (log2(this_DH.reputation / this_DH.number_of_escrows) * corrective_factor / 115) / (corrective_factor / 100);
		if(reputation == 0) reputation = 1;

		uint256 hash_difference = absoluteDifference(uint256(uint128(this_offer.data_hash)), uint256(uint128(keccak256(DH_wallet))));

		uint256 hash_f = ((uint256(uint128(this_offer.data_hash)) * (2**128)) / (hash_difference + uint256(uint128(this_offer.data_hash))));
		uint256 price_f = corrective_factor - ((corrective_factor * token_amount) / this_offer.max_token_amount_per_DH);
		uint256 stake_f = ((corrective_factor - ((this_offer.min_stake_amount_per_DH * corrective_factor) / stake_amount)) * uint256(uint128(this_offer.data_hash))) / (hash_difference + uint256(uint128(this_offer.data_hash)));
		uint256 rep_f = (corrective_factor - (this_offer.min_reputation * corrective_factor / reputation));
		distance = ((hash_f * (corrective_factor + price_f + stake_f + rep_f)) / 4) / corrective_factor;
	}
}