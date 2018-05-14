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
          
	event OfferCreated(address DC_wallet,bytes32 DC_node_id, uint data_id, uint total_escrow_time, uint max_token_amount, uint min_stake_amount, uint min_reputation, uint data_size, bytes32 data_hash);
	event OfferCanceled(address DC_wallet, uint data_id);
	event AddedBid(address DC_wallet,uint data_id, uint bid_index, address DH_wallet, bytes32 DH_node_id);
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

		emit OfferCreated(msg.sender, DC_node_id, data_id, total_escrow_time, max_token_amount, min_stake_amount, min_reputation, data_size, data_hash);
		return true;
	}

	//TODO Decide when and under which conditions DC can cancel an offer
	function cancelOffer(uint data_id)
	public{
		offer[msg.sender][data_id].active = false;
		emit OfferCanceled(msg.sender, data_id);
	}

	function addBid(address DC_wallet, uint data_id, bytes32 DH_node_id)
	public returns (uint this_bid_index){
		require(offer[DC_wallet][data_id].active && !offer[DC_wallet][data_id].finalized);

		OfferDefinition storage this_offer = offer[DC_wallet][data_id];
		DHProfileDefinition storage this_DH = DH_profile[msg.sender][DH_node_id];

		//Check if the the DH meets the filters DC set for the offer
		uint scope = this_offer.data_size * this_offer.total_escrow_time;
		require(this_offer.total_escrow_time <= this_DH.max_escrow_time);
		require(this_offer.max_token_amount  >= this_DH.token_amount * scope);
		require(this_offer.min_stake_amount  <= this_DH.stake_amount * scope);
		require(this_offer.min_reputation 	 <= this_DH.reputation);
		require(this_offer.data_size		 <= this_DH.size_available);

		//Create new bid in the list
		this_bid_index = this_offer.number_of_bids;
		BidDefinition storage this_bid = bid[DC_wallet][data_id][this_offer.number_of_bids];
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

		emit AddedBid(DC_wallet,data_id, this_bid_index, msg.sender, DH_node_id);
		return this_bid_index;
	}

	function getBidIndex(address DC_wallet, uint data_id, bytes32 DH_node_id) public view returns(uint){
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
		
		uint256 i;

		//Sending escrow requests to partners
		for(i = 0; i < N; i = i + 1){
			BidDefinition storage chosen_bid = bid[msg.sender][data_id][i];
			DHProfileDefinition storage chosen_DH = DH_profile[chosen_bid.DH_wallet][chosen_bid.DH_node_id];				

			//Initiating new escrow
			uint scope = this_offer.total_escrow_time * this_offer.data_size;
			uint stake_amount = chosen_DH.stake_amount * scope;
			uint token_amount = chosen_DH.token_amount * scope;
			escrow.initiateEscrow(msg.sender, chosen_bid.DH_wallet, data_id, token_amount, stake_amount, this_offer.total_escrow_time);
			chosen_bid.chosen = true;
			chosen_data_holders[i] = i;
			emit BidTaken(msg.sender, chosen_bid.DH_wallet, data_id);
		}		

		//Sending escrow requests to network bids
		uint256 bid_index = this_offer.first_bid_index;
		for(;i < 2 * N + 1 ; i = i + 1) {
			while(bid_index != uint(-1) && (bid[msg.sender][data_id][bid_index].canceled || bid[msg.sender][data_id][bid_index].chosen)){
				bid_index = bid[msg.sender][data_id][bid_index].next_bid;
			} 
			if(bid_index == uint(-1)) break;

			chosen_bid = bid[msg.sender][data_id][bid_index];
			chosen_DH = DH_profile[chosen_bid.DH_wallet][chosen_bid.DH_node_id];

			//Initiating new escrow
			scope = this_offer.total_escrow_time * this_offer.data_size;
			stake_amount = chosen_DH.stake_amount * scope;
			token_amount = chosen_DH.token_amount * scope;

			escrow.initiateEscrow(msg.sender, chosen_bid.DH_wallet, data_id, token_amount, stake_amount, this_offer.total_escrow_time);
			chosen_bid.chosen = true;
			chosen_data_holders[i] = bid_index;
			emit BidTaken(msg.sender, chosen_bid.DH_wallet, data_id);
		}
		
		offer[msg.sender][data_id].finalized = true;
		emit OfferFinalized(msg.sender,data_id); 
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