require('dotenv').config();

module.exports = {
	'NODE_IP': process.env.NODE_IP,
	'DB_TYPE': 'arango',
	'DB_USERNAME': process.env.DB_USERNAME,
	'DB_PASSWORD': process.env.DB_PASSWORD,
	'DB_HOST': process.env.DB_HOST,
	'DB_PORT': process.env.DB_PORT,
	'DB_DATABASE': process.env.DB_DATABASE,
	'MAX_PATH_LENGTH': process.env.MAX_PATH_LENGTH,
	'RPC_API_PORT': process.env.RPC_API_PORT,
	'IPC_API_PORT': process.env.IPC_API_PORT,
	'KADEMLIA_PORT': process.env.KADEMLIA_PORT,
	'WALLET_ID': process.env.WALLET_ID,
	'KADEMLIA_SEED_IP': process.env.KADEMLIA_SEED_IP,
	'KADEMLIA_SEED_PORT': process.env.KADEMLIA_SEED_PORT,
	'IS_KADEMLIA_BEACON': process.env.IS_KADEMLIA_BEACON,
	'REQUEST_TIMEOUT': process.env.REQUEST_TIMEOUT,
	'REMOTE_ACCESS': [process.env.REMOTE_ACCESS],
	'blockchain':{
		'preferred_chain': 'ethereum',
		'settings':{
			'ethereum' : {
				'token_contract': '0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882',
				'escrow_contract':'0xa38bf57abbd4522ccf20e3cfc45489b682fd2a46',
				'escrow_abi': 'modules/blockchain_interface/ethereum/contracts/escrow_abi.js',
				'escrow_bytecode':'6060604052341561000f57600080fd5b60405160208061122583398101604052808051906020019091905050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161415151561006757600080fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff16600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505061110c806101196000396000f300606060405260043610610078576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff168063410085df1461007d57806373718df5146100bf57806382b9be1a146101535780638d7c2489146101f657806395b9df2b14610288578063fc0c546a14610304575b600080fd5b341561008857600080fd5b6100bd600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091908035906020019091905050610359565b005b34156100ca57600080fd5b610139600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff169060200190919080359060200190919080359060200190919080359060200190919080359060200190919050506107e1565b604051808215151515815260200191505060405180910390f35b341561015e57600080fd5b6101b2600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff16906020019091908035906020019091905050610909565b604051808881526020018781526020018681526020018581526020018481526020018381526020018215151515815260200197505050505050505060405180910390f35b341561020157600080fd5b610286600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803590602001909190803590602001909190803590602001909190803515159060200190919080356000191690602001909190803560ff169060200190919080356000191690602001909190803560001916906020019091905050610972565b005b341561029357600080fd5b610302600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff16906020019091908035906020019091908035906020019091908035906020019091908035906020019091905050610d2e565b005b341561030f57600080fd5b61031761109c565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b60008033915062093a80600260008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008581526020019081526020016000206004015401421015151561040357600080fd5b600260008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600084815260200190815260200160002060010154600260008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000858152602001908152602001600020600001540390506000811180156105c75750600260008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008481526020019081526020016000206000015481105b156107db57600260008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600084815260200190815260200160002060000154600260008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600085815260200190815260200160002060010181905550600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663a9059cbb83836000604051602001526040518363ffffffff167c0100000000000000000000000000000000000000000000000000000000028152600401808373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200192505050602060405180830381600087803b15156107be57600080fd5b6102c65a03f115156107cf57600080fd5b50505060405180519050505b50505050565b6000803373ffffffffffffffffffffffffffffffffffffffff168773ffffffffffffffffffffffffffffffffffffffff1614151561081e57600080fd5b600260008973ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600087815260200190815260200160002090508481600001541480156108c35750838160030154145b80156108d25750828160050154145b15156108dd57600080fd5b60018160060160006101000a81548160ff02191690831515021790555060019150509695505050505050565b600260205282600052604060002060205281600052604060002060205280600052604060002060009250925050508060000154908060010154908060020154908060030154908060040154908060050154908060060160009054906101000a900460ff16905087565b600080600260008c73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008b815260200190815260200160002091508160060160009054906101000a900460ff161515610a2157600080fd5b81600001548260010154101515610a3757600080fd5b878260030154101515610a4957600080fd5b600186868686604051600081526020016040526000604051602001526040518085600019166000191681526020018460ff1660ff16815260200183600019166000191681526020018260001916600019168152602001945050505050602060405160208103908084039060008661646e5a03f11515610ac757600080fd5b50506020604051035173ffffffffffffffffffffffffffffffffffffffff168b73ffffffffffffffffffffffffffffffffffffffff16141515610b0957600080fd5b8560001916338b8b8b8b604051808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166c0100000000000000000000000002815260140185815260200184815260200183815260200182151515157f010000000000000000000000000000000000000000000000000000000000000002815260010195505050505050604051809103902060001916141515610bb557600080fd5b8615610d0e57888260020154141515610bcd57600080fd5b8160040154881115610be157816004015497505b816005015482600301548903836000015402811515610bfc57fe5b049050878260030181905550610c1f8183600101546110c290919063ffffffff16565b50600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663a9059cbb33836000604051602001526040518363ffffffff167c0100000000000000000000000000000000000000000000000000000000028152600401808373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200192505050602060405180830381600087803b1515610ced57600080fd5b6102c65a03f11515610cfe57600080fd5b5050506040518051905050610d21565b8882600201819055508782600301819055505b5050505050505050505050565b82600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663dd62ed3e33306000604051602001526040518363ffffffff167c0100000000000000000000000000000000000000000000000000000000028152600401808373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200192505050602060405180830381600087803b1515610e2857600080fd5b6102c65a03f11515610e3957600080fd5b5050506040518051905010151515610e5057600080fd5b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166323b872dd3330866000604051602001526040518463ffffffff167c0100000000000000000000000000000000000000000000000000000000028152600401808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018281526020019350505050602060405180830381600087803b1515610f5157600080fd5b6102c65a03f11515610f6257600080fd5b505050604051805190505060e0604051908101604052808481526020016000815260200160008152602001838152602001828401815260200182815260200160001515815250600260008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000868152602001908152602001600020600082015181600001556020820151816001015560408201518160020155606082015181600301556080820151816004015560a0820151816005015560c08201518160060160006101000a81548160ff021916908315150217905550905050505050505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60008082840190508381101515156110d657fe5b80915050929150505600a165627a7a723058204ed19612780787fdba66db96b2fda2846c36f53f622535a5ae030d99cedcc9bb0029',
				'token_bytecode':'60606040526000600360146101000a81548160ff021916908315150217905550635a5cc1f06004556b019d971e4fe8401e74000000600855341561004257600080fd5b604051602080611bda8339810160405280805190602001909190505033600360006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060008173ffffffffffffffffffffffffffffffffffffffff16141515156100c557600080fd5b80600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050611ac4806101166000396000f30060606040526004361061011d576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806305d2035b1461012257806306fdde031461014f578063095ea7b3146101dd57806318160ddd1461023757806323b872dd14610260578063313ce567146102d957806340c10f1914610308578063521eb2731461036257806366188463146103b757806370a082311461041157806378e979251461045e5780637d64bcb4146104875780638b8ecffa146104b45780638da5cb5b1461050957806395d89b411461055e578063a9059cbb146105ec578063c2572c5114610646578063c8e7e5ef1461069b578063d73dd623146106c4578063dd62ed3e1461071e578063f2fde38b1461078a575b600080fd5b341561012d57600080fd5b6101356107c3565b604051808215151515815260200191505060405180910390f35b341561015a57600080fd5b6101626107d6565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156101a2578082015181840152602081019050610187565b50505050905090810190601f1680156101cf5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34156101e857600080fd5b61021d600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803590602001909190505061080f565b604051808215151515815260200191505060405180910390f35b341561024257600080fd5b61024a610993565b6040518082815260200191505060405180910390f35b341561026b57600080fd5b6102bf600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff16906020019091908035906020019091905050610999565b604051808215151515815260200191505060405180910390f35b34156102e457600080fd5b6102ec6109ca565b604051808260ff1660ff16815260200191505060405180910390f35b341561031357600080fd5b610348600480803573ffffffffffffffffffffffffffffffffffffffff169060200190919080359060200190919050506109cf565b604051808215151515815260200191505060405180910390f35b341561036d57600080fd5b610375610a3f565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b34156103c257600080fd5b6103f7600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091908035906020019091905050610a65565b604051808215151515815260200191505060405180910390f35b341561041c57600080fd5b610448600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050610cf6565b6040518082815260200191505060405180910390f35b341561046957600080fd5b610471610d3f565b6040518082815260200191505060405180910390f35b341561049257600080fd5b61049a610d45565b604051808215151515815260200191505060405180910390f35b34156104bf57600080fd5b6104c7610df1565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b341561051457600080fd5b61051c610e17565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b341561056957600080fd5b610571610e3d565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156105b1578082015181840152602081019050610596565b50505050905090810190601f1680156105de5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34156105f757600080fd5b61062c600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091908035906020019091905050610e76565b604051808215151515815260200191505060405180910390f35b341561065157600080fd5b610659610ea5565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b34156106a657600080fd5b6106ae610ecb565b6040518082815260200191505060405180910390f35b34156106cf57600080fd5b610704600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091908035906020019091905050610ed1565b604051808215151515815260200191505060405180910390f35b341561072957600080fd5b610774600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff169060200190919050506110cd565b6040518082815260200191505060405180910390f35b341561079557600080fd5b6107c1600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050611154565b005b600360149054906101000a900460ff1681565b6040805190810160405280600f81526020017f416c7068615472616320546f6b656e000000000000000000000000000000000081525081565b600080600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054148061089b5750600082145b15156108a357fe5b81600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040518082815260200191505060405180910390a36001905092915050565b60005481565b6000600360149054906101000a900460ff1615156109b657600080fd5b6109c18484846112ac565b90509392505050565b601281565b6000600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515610a2d57600080fd5b610a37838361166b565b905092915050565b600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600080600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905080831115610b76576000600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550610c0a565b610b89838261183d90919063ffffffff16565b600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055505b8373ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546040518082815260200191505060405180910390a3600191505092915050565b6000600160008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b60045481565b6000600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515610da357600080fd5b6001600360146101000a81548160ff0219169083151502179055507fae5184fba832cb2b1f702aca6117b8d265eaf03ad33eb133f19dde0f5920fa0860405160405180910390a16001905090565b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6040805190810160405280600581526020017f415452414300000000000000000000000000000000000000000000000000000081525081565b6000600360149054906101000a900460ff161515610e9357600080fd5b610e9d8383611856565b905092915050565b600760009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60085481565b6000610f6282600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054611a7a90919063ffffffff16565b600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546040518082815260200191505060405180910390a36001905092915050565b6000600260008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415156111b057600080fd5b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16141515156111ec57600080fd5b8073ffffffffffffffffffffffffffffffffffffffff16600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a380600360006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b60008073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16141515156112e957600080fd5b600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054821115151561133757600080fd5b600260008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205482111515156113c257600080fd5b61141482600160008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461183d90919063ffffffff16565b600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506114a982600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054611a7a90919063ffffffff16565b600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061157b82600260008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461183d90919063ffffffff16565b600260008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a3600190509392505050565b6000600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415156116c957600080fd5b600360149054906101000a900460ff161515156116e557600080fd5b6116fa82600054611a7a90919063ffffffff16565b60008190555061175282600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054611a7a90919063ffffffff16565b600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff167f0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885836040518082815260200191505060405180910390a28273ffffffffffffffffffffffffffffffffffffffff1660007fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a36001905092915050565b600082821115151561184b57fe5b818303905092915050565b60008073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff161415151561189357600080fd5b600160003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205482111515156118e157600080fd5b61193382600160003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461183d90919063ffffffff16565b600160003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506119c882600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054611a7a90919063ffffffff16565b600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a36001905092915050565b6000808284019050838110151515611a8e57fe5b80915050929150505600a165627a7a723058207521fc64764334e4e2da7b3bfc57ce8935b705ade9e9945d59aea5801597f77e0029',
				'token_abi':'modules/blockchain_interface/ethereum/contracts/token_abi.js',
				'network': 'rinkeby',
				'wallet_address': process.env.WALLET_ADDRESS,
				'private_key': process.env.PRIVATE_KEY,
				'contract_bytecode': '606060405262093a80600155341561001657600080fd5b6040516020806108fc83398101604052808051906020019091905050336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508060028190555050610873806100896000396000f30060606040526004361061008d576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff1680620be63914610092578063037a4c38146100f45780630d8e6e2c146101835780633a7941f8146101ac5780633e118dbe1461020e5780638da5cb5b146102375780639201de551461028c578063f2fde38b1461032c575b600080fd5b341561009d57600080fd5b6100d6600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803560001916906020019091905050610365565b60405180826000191660001916815260200191505060405180910390f35b34156100ff57600080fd5b610169600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843782019150505050505091908035600019169060200190919080356000191690602001909190505061038a565b604051808215151515815260200191505060405180910390f35b341561018e57600080fd5b6101966104f8565b6040518082815260200191505060405180910390f35b34156101b757600080fd5b6101f0600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803560001916906020019091905050610502565b60405180826000191660001916815260200191505060405180910390f35b341561021957600080fd5b6102216105a0565b6040518082815260200191505060405180910390f35b341561024257600080fd5b61024a6105a6565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b341561029757600080fd5b6102b16004808035600019169060200190919050506105cb565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156102f15780820151818401526020810190506102d6565b50505050905090810190601f16801561031e5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b341561033757600080fd5b610363600480803573ffffffffffffffffffffffffffffffffffffffff169060200190919050506106ca565b005b6003602052816000526040600020602052806000526040600020600091509150505481565b60008073ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515156103c757600080fd5b81600360003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600085600019166000191681526020019081526020016000208160001916905550836040518082805190602001908083835b60208310151561045e5780518252602082019150602081019050602083039250610439565b6001836020036101000a03801982511681845116808217855250505050505090500191505060405180910390203373ffffffffffffffffffffffffffffffffffffffff167f2a87ffb089688d8430d27ae416aac00c02c0a287c0764d29018525e4ff01da45858560405180836000191660001916815260200182600019166000191681526020019250505060405180910390a39392505050565b6000600254905090565b60008073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff161415151561053f57600080fd5b600360008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000836000191660001916815260200190815260200160002054905092915050565b60025481565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6105d361081f565b6105db610833565b60008060206040518059106105ed5750595b9080825280601f01601f19166020018201604052509250600091505b60208210156106bf578160080260020a856001900402600102905060007f010000000000000000000000000000000000000000000000000000000000000002817effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff19161415156106b25780838381518110151561068157fe5b9060200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a9053505b8180600101925050610609565b829350505050919050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614151561072557600080fd5b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161415151561076157600080fd5b8073ffffffffffffffffffffffffffffffffffffffff166000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a3806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b602060405190810160405280600081525090565b6020604051908101604052806000815250905600a165627a7a72305820cc75fad3044d79294ab40db826904e4446135c3a14d6166b3ebfb0b6f92241d60029',
				'contract_address':  '0x8126e8a02bcae11a631d4413b9bd4f01f14e045d',
				'contract_abi': 'modules/blockchain_interface/ethereum/contracts/contract_abi.js',
				'rpc_node': 'http://ec2-52-59-72-10.eu-central-1.compute.amazonaws.com',
				'node_port': '80',
				'gas_limit': process.env.GAS_LIMIT,
				'gas_price': process.env.GAS_PRICE
			},
			'iota': {
				'i':'// TODO: setup testing Iota node'
			},
			'neo':{
				'i':'// TODO: setup testing Neo node'
			}
		}
	}
};
