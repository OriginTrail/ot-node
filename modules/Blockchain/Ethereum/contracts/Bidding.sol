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

contract Bidding {
	using SafeMath for uint256;

	ERC20 public token;
	address public escrow;

	function Bidding(address tokenAddress, address escrowAddress)
	public{
		require ( tokenAddress != address(0) && escrowAddress != address(0));
		token = ERC20(tokenAddress);
		escrow = escrowAddress;
	}


	/*    ----------------------------- BIDDING -----------------------------     */


	struct OfferDefinition{
		//Parameters of one escrow
		uint total_escrow_time;
		// uint max_token_amount;
		uint min_stake_amount; 

		//Parameters for the bidding 
		uint reveal_start_time;
		uint choose_start_time;
		uint min_number_of_bids;

		//Parameters of the data
		uint data_size;
		uint replication_factor; //Number of DH's required
		

		//Parameters for use during the bidding mechanism
		uint256 number_of_bids;
		uint256 number_of_bids_revealed;
		uint total_bid_token_amount;
		uint random_number_seed;
		bool active;
	}

	struct BidDefinition{
		bytes32 bid_hash;
		address DH_wallet;
		uint node_id;
		uint token_amount;
		uint stake_amount;
		bool active;
		bool chosen;
	}

	mapping(address => mapping(uint => OfferDefinition)) public offer;
	mapping(address => mapping(uint => mapping(uint => BidDefinition))) public bid; 

	event OfferCreated(address DC_wallet,uint DC_node_id, uint data_id, uint total_escrow_time, uint min_stake_amount, uint data_size);
	event OfferCanceled(address DC_wallet, uint data_id);
	// event RevealPhaseStarted(address DC_wallet, uint data_id);
	// event ChoosingPhaseStarted(address DC_wallet, uint data_id);
	event BidTaken(address DC_wallet, address DH_wallet, uint data_id);

	function createOffer(
	uint data_id, 
	uint DC_node_id,
		uint total_escrow_time, 
		uint min_stake_amount,
		uint bidding_phase_time,
		uint min_number_of_bids, 
		uint data_size, 
		uint replication_factor)
	public returns (uint choose_start_time){

		require(total_escrow_time > 0 && min_number_of_bids > 0 && bidding_phase_time > 0 && replication_factor > 1);
		require(replication_factor <= min_number_of_bids);
		require(offer[msg.sender][data_id].active == false);

		// require(token.allowance(msg.sender,this) >= SafeMath.mul(tokens_per_DH,replication_factor));
		// token.transferFrom(msg.sender,this,SafeMath.mul(tokens_per_DH,replication_factor));
		
		offer[msg.sender][data_id].total_escrow_time = total_escrow_time;
		//offer[msg.sender][data_id].min_token_amount = min_token_amount;
		offer[msg.sender][data_id].min_stake_amount = min_stake_amount;

		offer[msg.sender][data_id].reveal_start_time = block.timestamp + bidding_phase_time;
		choose_start_time = offer[msg.sender][data_id].choose_start_time = block.timestamp + 2 * bidding_phase_time;
		offer[msg.sender][data_id].min_number_of_bids = min_number_of_bids;

		offer[msg.sender][data_id].data_size = data_size;
		offer[msg.sender][data_id].replication_factor = replication_factor;
		
	    offer[msg.sender][data_id].number_of_bids = 0;
	    offer[msg.sender][data_id].number_of_bids_revealed = 0;
		offer[msg.sender][data_id].active = true;
		OfferCreated(msg.sender, DC_node_id, data_id, total_escrow_time, min_stake_amount, data_size);
	}


	//Da li vraca pare? Kada sme da uradi cancel?
	function cancelOffer(uint data_id)
	public{
		offer[msg.sender][data_id].active = false;

		OfferCanceled(msg.sender, data_id);
	}

    function getBid(address DC_wallet, uint data_id, uint bidIndex) public constant returns (bool isBidChosen){
        return bid[DC_wallet][data_id][bidIndex].chosen;
    }
    function getOfferStatus(address DC_wallet, uint data_id) public constant returns (bool isBidChosen){
        return offer[DC_wallet][data_id].active;
    }
    
	function addBid(address DC_wallet, uint data_id, uint node_id, uint token_amount, uint stake_amount)
	public returns (uint bidIndex){
		require(offer[DC_wallet][data_id].active);
		require(offer[DC_wallet][data_id].reveal_start_time > block.timestamp);

		// require(token_amount <= offer[DC_wallet][data_id].token_amount);
		require(stake_amount >= offer[DC_wallet][data_id].min_stake_amount);
		require(token_amount > 0);

		offer[DC_wallet][data_id].number_of_bids = offer[DC_wallet][data_id].number_of_bids.add(1);
		bidIndex = offer[DC_wallet][data_id].number_of_bids;

		bid[DC_wallet][data_id][bidIndex].bid_hash = keccak256(msg.sender, node_id, token_amount, stake_amount);
		
		return bidIndex;
	}

	function revealBid(address DC_wallet, uint data_id, uint node_id, uint token_amount, uint stake_amount, uint bidIndex)
	public {

		require(offer[DC_wallet][data_id].active);
		require(offer[DC_wallet][data_id].reveal_start_time <= block.timestamp);
		require(offer[DC_wallet][data_id].choose_start_time > block.timestamp);

		require(bid[DC_wallet][data_id][bidIndex].bid_hash == keccak256(msg.sender, node_id, token_amount, stake_amount));

		bid[DC_wallet][data_id][bidIndex].DH_wallet = msg.sender;
		bid[DC_wallet][data_id][bidIndex].node_id = node_id;
		bid[DC_wallet][data_id][bidIndex].token_amount = token_amount;
		bid[DC_wallet][data_id][bidIndex].stake_amount = stake_amount;
		bid[DC_wallet][data_id][bidIndex].active = true;

		OfferDefinition storage this_offer = offer[msg.sender][data_id];

		this_offer.total_bid_token_amount = this_offer.total_bid_token_amount.add(token_amount);
		this_offer.number_of_bids_revealed = this_offer.number_of_bids_revealed.add(1);
		this_offer.random_number_seed = this_offer.random_number_seed + block.number;//FIX

	}

	function cancelBid(address DC_wallet, uint data_id, uint bidIndex)
	public{
		require(bid[DC_wallet][data_id][bidIndex].DH_wallet == msg.sender);
		require(bid[DC_wallet][data_id][bidIndex].active);

		offer[DC_wallet][data_id].total_bid_token_amount = offer[DC_wallet][data_id].total_bid_token_amount.sub(bid[DC_wallet][data_id][bidIndex].token_amount);
		offer[DC_wallet][data_id].number_of_bids_revealed = offer[DC_wallet][data_id].number_of_bids_revealed.sub(1);

		bid[DC_wallet][data_id][bidIndex].token_amount = 0;
		bid[DC_wallet][data_id][bidIndex].active = false;
	}

	function chooseBids(uint data_id)
	public returns (uint256[] chosen_data_holders){

		OfferDefinition storage this_offer = offer[msg.sender][data_id];

		require(this_offer.min_number_of_bids <= this_offer.number_of_bids_revealed);
		require(this_offer.choose_start_time <= block.timestamp);

		uint N = this_offer.replication_factor;
		chosen_data_holders = new uint256[](N);
		
		uint256 i = 0;
		uint256 seed = this_offer.random_number_seed;
		while(i < N && N >= this_offer.number_of_bids_revealed){	//FIX: Should be hash(block.hash)
			
			uint nextIndex = (seed * this_offer.number_of_bids + block.timestamp) % this_offer.total_bid_token_amount;
			uint256 j = 0;
			uint256 sum = bid[msg.sender][data_id][j].token_amount;
			while(sum < nextIndex){
				j++;
				sum = sum.add(bid[msg.sender][data_id][j].token_amount);
			}
			BidDefinition storage chosenBid = bid[msg.sender][data_id][j];
			if(token.allowance(chosenBid.DH_wallet,this) >= chosenBid.token_amount
				&& token.balanceOf(chosenBid.DH_wallet) >= chosenBid.token_amount){

				this_offer.number_of_bids_revealed = this_offer.number_of_bids_revealed.sub(1);
				this_offer.total_bid_token_amount = this_offer.total_bid_token_amount.sub(chosenBid.token_amount);
				uint amount_to_transfer = chosenBid.token_amount;
				chosenBid.token_amount = 0;
				token.transferFrom(msg.sender,escrow,amount_to_transfer);
				
				//TODO Ako DC odmah salje pare ovde racunati koliko treba da mu se vrati
				chosenBid.chosen = true;
				chosen_data_holders[i] = j;
				i++;
				BidTaken(msg.sender, chosenBid.DH_wallet, data_id);
			}
			else{
				this_offer.number_of_bids_revealed = this_offer.number_of_bids_revealed.sub(1);
				this_offer.total_bid_token_amount = this_offer.total_bid_token_amount.sub(chosenBid.token_amount);
				chosenBid.active = false;
				chosenBid.token_amount = 0;
			}
		}


	}
}