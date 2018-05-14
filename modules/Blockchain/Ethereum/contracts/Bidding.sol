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
	function initiateEscrow(address DC_wallet, address DH_wallet, uint data_id, uint token_amount,uint stake_amount, uint total_time) public;
}

contract Bidding {
	using SafeMath for uint256;

	ERC20 public token;
	EscrowHolder public escrow;
	uint TOTAL_NUM_TOKENS = 500000000;

	function Bidding(address tokenAddress, address escrowAddress)
	public{
		require ( tokenAddress != address(0) && escrowAddress != address(0));
		token = ERC20(tokenAddress);
		escrow = EscrowHolder(escrowAddress);
	}


	/*    ----------------------------- BIDDING -----------------------------     */


	struct OfferDefinition{
		//Parameters for DH filtering
		uint max_token_amount;
		uint min_stake_amount; 
		uint min_reputation;

		//Data holding parameters
		uint total_escrow_time;
		uint data_size;

		//Parameters for the bidding ranking
		bytes32 data_hash;
		uint first_bid_index;

		uint required_number_of_bids; 
		uint256 number_of_bids;
		uint replication_factor;

		bool active;
		bool finalized;
	}

	struct DHProfileDefinition{
		//Offer Parameters
		uint token_amount; //Per byte per minute
		uint stake_amount; //Per byte per minute

		uint balance;

		uint max_escrow_time;
		uint size_available;

		uint reputation;
	}

	struct BidDefinition{
		address DH_wallet;
		bytes32 DH_node_id;

		uint256 distance;

		uint next_bid;

		bool canceled;
		bool chosen;
	}

	mapping(address => mapping(uint => mapping(uint => BidDefinition))) public bid; // bid[DC_wallet][data_id][bid_index]
	mapping(address => mapping(uint => OfferDefinition)) public offer; //offer[DC_wallet][data_id]
	mapping(address => mapping(bytes32 => DHProfileDefinition)) public DH_profile; //DH_profile[DH_wallet][DH_node_id]

	event OfferCreated(address DC_wallet,bytes32 DC_node_id, uint data_id, uint total_escrow_time, uint max_token_amount, uint min_stake_amount, uint data_size);
	event OfferCanceled(address DC_wallet, uint data_id);
	event AddedBid(address DC_wallet,uint data_id, uint bid_index, address DH_wallet, bytes32 DH_node_id, bytes32 bid_hash);
	event FinalizeOfferReady(address DC_wallet,uint data_id);
	event BidTaken(address DC_wallet, address DH_wallet, uint data_id);
	event OfferFinalized(address DC_wallet,uint data_id);

	/*    ----------------------------- OFFERS -----------------------------     */

	function createOffer(
		uint data_id, //nonce/import_id/... 
		bytes32 DC_node_id,

		uint total_escrow_time, 
		uint max_token_amount,
		uint min_stake_amount,
		uint min_reputation,

		bytes32 data_hash,
		uint data_size,

		address[] predetermined_DC_wallet,
		bytes32[] predetermined_DC_node_id)
	public returns (bool offerCreated){

		require(max_token_amount > 0 && total_escrow_time > 0 && data_size > 0);
		require(offer[msg.sender][data_id].active == false);

		offer[msg.sender][data_id].total_escrow_time = total_escrow_time;
		offer[msg.sender][data_id].max_token_amount = max_token_amount;
		offer[msg.sender][data_id].min_stake_amount = min_stake_amount;
		offer[msg.sender][data_id].min_reputation = min_reputation;

		offer[msg.sender][data_id].data_hash = data_hash;
		offer[msg.sender][data_id].data_size = data_size;

		offer[msg.sender][data_id].required_number_of_bids = predetermined_DC_wallet.length.mul(3).add(1);
		offer[msg.sender][data_id].number_of_bids = predetermined_DC_wallet.length;
		offer[msg.sender][data_id].replication_factor = predetermined_DC_wallet.length.mul(2).add(1);

		offer[msg.sender][data_id].active = true;
		offer[msg.sender][data_id].finalized = false;

		offer[msg.sender][data_id].first_bid_index = uint(-1);

		//Writing the predetermined DC into the bid list
		uint256 i = 0;
		while( i < predetermined_DC_wallet.length) {
			bid[msg.sender][data_id][i].DH_wallet = predetermined_DC_wallet[i];
			bid[msg.sender][data_id][i].DH_node_id = predetermined_DC_node_id[i];
			i = i + 1;
		}

		OfferCreated(msg.sender, DC_node_id, data_id, total_escrow_time, max_token_amount, min_stake_amount, min_reputation, data_size, data_hash);
	}

	//TODO Decide when and under which conditions DC can cancel an offer
	function cancelOffer(bytes32 DC_node_id, uint data_id)
	public{
		offer[msg.sender][DC_node_id][data_id].active = false;
		OfferCanceled(msg.sender, DC_node_id, data_id);
	}

	function addBid(address DC_wallet, uint data_id, bytes32 DH_node_id)
	public returns (uint this_bid_index){
		require(offer[DC_wallet][data_id].active && !offer[DC_wallet][data_id].finalized);

		OfferDefinition this_offer = offer[DC_wallet][data_id];
		DHProfileDefinition this_DH = DH_profile[msg.sender][DH_node_id];

		//Check if the the DH meets the filters DC set for the offer
		uint scope = this_offer.data_size * this_offer.total_escrow_time;
		require(this_offer.total_escrow_time <= DH_profile.max_escrow_time);
		require(this_offer.max_token_amount  >= DH_profile.token_amount * scope);
		require(this_offer.min_stake_amount  <= DH_profile.stake_amount * scope);
		require(this_offer.min_reputation 	 <= DH_profile.reputation);
		require(this_offer.data_size		 <= DH_profile.size_available);

		//Create new bid in the list
		this_bid_index = this_offer.number_of_bids;
		BidDefinition storage this_bid = bid[DC_wallet][data_id][number_of_bids];
		this_offer.number_of_bids = this_offer.number_of_bids.add(1);
		this_bid.DH_wallet = msg.sender;
		this_bid.DH_node_id = DH_node_id;
		this_bid.distance = absoluteDifference(uint256(keccak256(msg.sender, DH_node_id)),uint256(this_offer.data_hash));

		//Insert the bid in the proper place in the list
		uint256 current_index = this_offer.first_bid_index;
		uint256 previous_index = uint(-1); // trust me, i'm an engineer
		while(current_index != uint(-1) && bid[DC_wallet][data_id][current_index].distance <= this_bid.distance){
			previous_index = current_index;
			current_index = bid[DC_wallet][data_id][current_index].next_bid;
		}
		this_bid.next_bid = current_index;
		if(previous_index == uint(-1)) this_offer.first_bid_index = this_bid_index;
		else {
			assert(bid[DC_wallet][data_id][previous_index].DH_wallet != msg.sender && bid[DC_wallet][data_id][previous_index].DH_node_id != DH_node_id);
			bid[DC_wallet][data_id][previous_index].next_bid = this_bid_index;
		}
		this_offer.number_of_bids = this_offer.number_of_bids.add(1);
		if(this_offer.number_of_bids >= this_offer.required_number_of_bids) emit FinalizeOfferReady(DC_wallet, data_id);

		AddedBid(DC_wallet,data_id, this_bid_index, msg.sender, DH_node_id, bid_hash);
		return this_bid_index;
	}

	function getBidIndex(address DC_wallet, uint data_id, uint DH_node_id){
		OfferDefinition storage this_offer = offer[DC_wallet][data_id];
		uint256 i = 0;
		while(i < this_offer.number_of_bids && (bid[DC_wallet][data_id][i].DH_wallet != msg.sender || bid[DC_wallet][data_id][i].DH_node_id != DH_node_id)) i = i + 1;
		if( i == this_offer.number_of_bids) return uint(-1);
		else return i;
	}

	function cancelBid(address DC_wallet, uint data_id, uint bid_index)
	public{
		require(bid[DC_wallet][data_id][bid_index].DH_wallet == msg.sender);
		bid[DC_wallet][data_id][bid_index].canceled = true;
	}

	function chooseBids(uint data_id) public returns (uint256[] chosen_data_holders){

		OfferDefinition storage this_offer = offer[msg.sender][data_id];
		require(this_offer.active && !this_offer.finalized);
		require(this_offer.required_number_of_bids <= this_offer.number_of_bids);

		uint256 N = this_offer.required_number_of_bids.sub(1).div(3);
		chosen_data_holders = new uint256[](N.mul(2).add(1));
		
		uint256 i = 0;
		
		while(i < N && N <= this_offer.number_of_bids_revealed){	//FIX: Should be hash(block.hash)
			
			uint nextIndex = (seed * this_offer.number_of_bids + block.timestamp) % this_offer.total_bid_chance;
			uint256 j = 0;
			uint256 sum = bid[msg.sender][data_id][j].chance;
			while(sum < nextIndex){
				j++;
				sum = sum.add(bid[msg.sender][data_id][j].chance);
			}
			BidDefinition storage chosenBid = bid[msg.sender][data_id][j];
			if(token.allowance(chosenBid.DH_wallet,this) >= chosenBid.stake_amount
				&& token.balanceOf(chosenBid.DH_wallet) >= chosenBid.stake_amount){

				uint stake_to_transfer = chosenBid.stake_amount;
				chosenBid.stake_amount = 0;
				chosenBid.chance = 0;

				//Initiating new escrow
				escrow.initiateEscrow(msg.sender, chosenBid.DH_wallet, data_id, chosenBid.token_amount, stake_to_transfer, this_offer.total_escrow_time);	
				//TODO Ako DC odmah salje pare ovde racunati koliko treba da mu se vrati
				chosenBid.chosen = true;
				chosen_data_holders[i] = j;
				i++;
				BidTaken(msg.sender, chosenBid.DH_wallet, data_id);
			}
			else{
				this_offer.number_of_bids_revealed = this_offer.number_of_bids_revealed.sub(1);
				chosenBid.chance = 0;
				chosenBid.active = false;
				
			}
			chosenBid.chance = 0;
			this_offer.total_bid_chance = this_offer.total_bid_chance.sub(chosenBid.chance);
		}



		offer[msg.sender][data_id].finalized = true;
		OfferFinalized(msg.sender,data_id);
	}


	function isBidChosen(address DC_wallet, uint data_id, uint bid_index) public constant returns (bool _isBidChosen){
		return bid[DC_wallet][data_id][bid_index].chosen;
	}

	function getOfferStatus(address DC_wallet, uint data_id) public constant returns (bool isOfferFinal){
		return offer[DC_wallet][data_id].finalized;
	}

	/*    ----------------------------- DH PROFILE -----------------------------    */
	
	event DHProfileCreated(address DH_wallet, bytes32 DH_node_id);
	event BalanceModified(address DH_wallet, bytes32 DH_node_id, uint new_balance);

	function createProfile(bytes32 DH_node_id, uint price, uint stake, uint max_time, uint max_size) public{
		DHProfileDefinition storage this_DH = DH_profile[msg.sender][DH_node_id];
		this_DH.token_amount = price;
		this_DH.stake_amount = stake;
		this_DH.max_escrow_time = max_time;
		this_DH.size_available = max_size;
		emit DHProfileCreated(msg.sender, DH_node_id);
	}
	
	function setPrice(bytes32 DH_node_id, uint new_price) public {
		DH_profile[msg.sender][DH_node_id].token_amount = new_price;
	}
	
	function setStake(bytes32 DH_node_id, uint new_stake) public {
		DH_profile[msg.sender][DH_node_id].stake_amount = new_stake;
	}
	
	function setMaxTime(bytes32 DH_node_id, uint new_max_time) public {
		DH_profile[msg.sender][DH_node_id].max_escrow_time = new_max_time;
	}
	
	function setFreeSpace(bytes32 DH_node_id, uint new_space) public {
		DH_profile[msg.sender][DH_node_id].size_available = new_space;
	}

	function increaseBalance(bytes32 DH_node_id, uint amount) public {
		require(token.balanceOf(msg.sender) >= amount && token.allowance(msg.sender, this) >= amount);
		uint amount_to_transfer = amount;
		amount = 0;
		if(amount_to_transfer > 0) token.transferFrom(msg.sender, this, amount_to_transfer);
		DH_profile[msg.sender][DH_node_id].balance = DH_profile[msg.sender][DH_node_id].balance.add(amount);
		emit BalanceModified(msg.sender, DH_node_id, DH_profile[msg.sender][DH_node_id].balance);
	}

	function decreaseBalance(bytes32 DH_node_id, uint amount) public {
		uint256 amount_to_transfer;
		if(DH_profile[msg.sender][DH_node_id].balance >= amount){
			amount_to_transfer = amount;
			DH_profile[msg.sender][DH_node_id].balance = DH_profile[msg.sender][DH_node_id].balance.sub(amount);
		}
		else{ 
			amount_to_transfer = DH_profile[msg.sender][DH_node_id].balance;
			DH_profile[msg.sender][DH_node_id].balance = 0;
		}
		amount = 0;
		if(amount_to_transfer > 0) token.transfer(msg.sender, amount_to_transfer);
		emit BalanceModified(msg.sender, DH_node_id, DH_profile[msg.sender][DH_node_id].balance);

	}

	function absoluteDifference(uint256 a, uint256 b) public pure returns (uint256) {
		if (a > b) return a-b;
		else return b-a;
	}
}