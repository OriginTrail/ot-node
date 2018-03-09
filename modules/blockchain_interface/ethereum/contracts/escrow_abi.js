[
	{
		"constant": true,
		"inputs": [],
		"name": "token",
		"outputs": [
			{
				"name": "",
				"type": "address"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [
			{
				"name": "",
				"type": "address"
			},
			{
				"name": "",
				"type": "address"
			},
			{
				"name": "",
				"type": "uint256"
			}
		],
		"name": "escrow",
		"outputs": [
			{
				"name": "token_amount",
				"type": "uint256"
			},
			{
				"name": "tokens_sent",
				"type": "uint256"
			},
			{
				"name": "verification_number",
				"type": "uint256"
			},
			{
				"name": "last_confirmation_time",
				"type": "uint256"
			},
			{
				"name": "end_time",
				"type": "uint256"
			},
			{
				"name": "total_time",
				"type": "uint256"
			},
			{
				"name": "verified",
				"type": "bool"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	},
	{
		"constant": false,
		"inputs": [
			{
				"name": "DH_wallet",
				"type": "address"
			},
			{
				"name": "data_id",
				"type": "uint256"
			},
			{
				"name": "token_amount",
				"type": "uint256"
			},
			{
				"name": "start_time",
				"type": "uint256"
			},
			{
				"name": "total_time",
				"type": "uint256"
			}
		],
		"name": "initiateEscrow",
		"outputs": [],
		"payable": false,
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"constant": false,
		"inputs": [
			{
				"name": "DC_wallet",
				"type": "address"
			},
			{
				"name": "data_id",
				"type": "uint256"
			},
			{
				"name": "confirmation_verification_number",
				"type": "uint256"
			},
			{
				"name": "confirmation_time",
				"type": "uint256"
			},
			{
				"name": "confirmation_valid",
				"type": "bool"
			},
			{
				"name": "confirmation_hash",
				"type": "bytes32"
			},
			{
				"name": "v",
				"type": "uint8"
			},
			{
				"name": "r",
				"type": "bytes32"
			},
			{
				"name": "s",
				"type": "bytes32"
			}
		],
		"name": "payOut",
		"outputs": [],
		"payable": false,
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"constant": false,
		"inputs": [
			{
				"name": "DH_wallet",
				"type": "address"
			},
			{
				"name": "data_id",
				"type": "uint256"
			}
		],
		"name": "refund",
		"outputs": [],
		"payable": false,
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"constant": false,
		"inputs": [
			{
				"name": "DC_wallet",
				"type": "address"
			},
			{
				"name": "DH_wallet",
				"type": "address"
			},
			{
				"name": "data_id",
				"type": "uint256"
			},
			{
				"name": "token_amount",
				"type": "uint256"
			},
			{
				"name": "start_time",
				"type": "uint256"
			},
			{
				"name": "total_time",
				"type": "uint256"
			}
		],
		"name": "verify",
		"outputs": [
			{
				"name": "isCorrect",
				"type": "bool"
			}
		],
		"payable": false,
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"name": "tokenAddress",
				"type": "address"
			}
		],
		"payable": false,
		"stateMutability": "nonpayable",
		"type": "constructor"
	}
];