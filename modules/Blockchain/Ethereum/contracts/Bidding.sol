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

contract Bidding {
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

		BidDefinition[] bid;
	}

	struct ProfileDefinition{
		//Offer Parameters
		uint token_amount_per_byte_minute; //Per byte per minute
		uint stake_amount_per_byte_minute; //Per byte per minute

		uint read_stake_factor;

		uint balance;
		uint reputation;

		uint max_escrow_time_in_minutes;
		uint size_available_in_bytes;

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

	//mapping(bytes32 => mapping(uint => BidDefinition)) public bid; // offer[import_id].bid[bid_index]
	mapping(bytes32 => OfferDefinition) public offer; //offer[import_id] import_id = keccak256(DC_wallet, DC_node_id, nonce)
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
		require(this_offer.active && this_offer.DC_wallet == msg.sender);
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
		require(this_offer.data_size_in_bytes		 <= this_DH.size_available_in_bytes);

		//Write the required data for the bid
		this_bid.token_amount_for_escrow = this_DH.token_amount_per_byte_minute * scope;
		this_bid.stake_amount_for_escrow = this_DH.stake_amount_per_byte_minute * scope;
		this_bid.active = true;
	}

	function addBid(bytes32 import_id, bytes32 DH_node_id)
	public returns (uint this_bid_index){
		require(offer[import_id].active && !offer[import_id].finalized);

		OfferDefinition storage this_offer = offer[import_id];
		ProfileDefinition storage this_DH = profile[msg.sender];

		//Check if the the DH meets the filters DC set for the offer
		uint scope = this_offer.data_size_in_bytes * this_offer.total_escrow_time_in_minutes;
		require(this_offer.total_escrow_time_in_minutes <= this_DH.max_escrow_time_in_minutes);
		require(this_offer.max_token_amount_per_DH  >= this_DH.token_amount_per_byte_minute * scope);
		require((this_offer.min_stake_amount_per_DH  <= this_DH.stake_amount_per_byte_minute * scope) && (this_DH.stake_amount_per_byte_minute * scope <= profile[msg.sender].balance));
		require(this_offer.min_reputation 	 <= profile[msg.sender].reputation);
		require(this_offer.data_size_in_bytes		 <= this_DH.size_available_in_bytes);

		//Create new bid in the list
		this_bid_index = this_offer.bid.length;
		BidDefinition memory new_bid = BidDefinition(msg.sender, DH_node_id, this_DH.token_amount_per_byte_minute * scope, this_DH.stake_amount_per_byte_minute * scope, 0, uint(-1), true, false);

		// distance = | hash(wallet, node_id) + token_amount - data_hash - stake_amount |
		new_bid.distance = absoluteDifference(uint256(keccak256(msg.sender, DH_node_id)).add(new_bid.token_amount_for_escrow),uint256(this_offer.data_hash).add(new_bid.stake_amount_for_escrow));


		//Insert the bid in the proper place in the list
		if(this_offer.first_bid_index == uint(-1)){
			this_offer.first_bid_index = this_bid_index;
			this_offer.bid.push(new_bid);
		}
		else{
			uint256 current_index = this_offer.first_bid_index;
			if(this_offer.bid[current_index].distance > new_bid.distance){
				this_offer.first_bid_index = this_bid_index;
				new_bid.next_bid = current_index;
				this_offer.bid.push(new_bid);
			}
			else {
				while(this_offer.bid[current_index].next_bid != uint(-1) && this_offer.bid[current_index].distance <= new_bid.distance){
					current_index = this_offer.bid[current_index].next_bid;
				}
				if(this_offer.bid[current_index].next_bid == uint(-1)){
					this_offer.bid[current_index].next_bid = this_bid_index;
					this_offer.bid.push(new_bid);
				}
				else{
					new_bid.next_bid = this_offer.bid[current_index].next_bid;
					this_offer.bid[current_index].next_bid = this_bid_index;
					this_offer.bid.push(new_bid);
				}
			}
		}

		if(this_offer.bid.length >= this_offer.replication_factor.mul(3).add(1)) emit FinalizeOfferReady(import_id);

		emit AddedBid(import_id, msg.sender, DH_node_id, this_bid_index);
		return this_bid_index;
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

		chosen_data_holders = new uint256[](this_offer.replication_factor.mul(2).add(1));

		uint256 i;
		uint256 current_index = 0;

		uint256 token_amount_sent = 0;
		uint256 max_total_token_amount = this_offer.max_token_amount_per_DH.mul(this_offer.replication_factor.mul(2).add(1));

		//Sending escrow requests to predetermined bids
		for(i = 0; i < this_offer.replication_factor; i = i + 1){
			BidDefinition storage chosen_bid = this_offer.bid[i];
			ProfileDefinition storage chosen_DH = profile[chosen_bid.DH_wallet];				

			if(profile[chosen_bid.DH_wallet].balance >= chosen_bid.stake_amount_for_escrow && chosen_bid.active && profile[chosen_bid.DH_wallet].size_available_in_bytes >= this_offer.data_size_in_bytes){
				//Initiating new escrow
				escrow.initiateEscrow(msg.sender, chosen_bid.DH_wallet, import_id, chosen_bid.token_amount_for_escrow, chosen_bid.stake_amount_for_escrow, this_offer.total_escrow_time_in_minutes);

				token_amount_sent = token_amount_sent.add(chosen_bid.token_amount_for_escrow);

				//chosen_DH.size_available_in_bytes = chosen_DH.size_available_in_bytes.sub(this_offer.data_size_in_bytes);

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

			if(profile[chosen_bid.DH_wallet].balance >= chosen_bid.stake_amount_for_escrow && profile[chosen_bid.DH_wallet].size_available_in_bytes >= this_offer.data_size_in_bytes){
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

	function createProfile(bytes32 node_id, uint price_per_byte_minute, uint stake_per_byte_minute, uint read_stake_factor, uint max_time_in_minutes, uint max_size_in_bytes) public{
		ProfileDefinition storage this_profile = profile[msg.sender];
		require(!this_profile.active);
		this_profile.active = true;
		this_profile.token_amount_per_byte_minute = price_per_byte_minute;
		this_profile.stake_amount_per_byte_minute = stake_per_byte_minute;
		this_profile.read_stake_factor = read_stake_factor;
		this_profile.max_escrow_time_in_minutes = max_time_in_minutes;
		this_profile.size_available_in_bytes = max_size_in_bytes;
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

	function setFreeSpace(uint new_space_in_bytes) public {
		profile[msg.sender].size_available_in_bytes = new_space_in_bytes;
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

	function absoluteDifference(uint256 a, uint256 b) public pure returns (uint256) {
		if (a > b) return a-b;
		else return b-a;
	}
}