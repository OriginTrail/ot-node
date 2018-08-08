# Changelog

## V1.1.0b release notes (20/07/2018)
# V1.1.0b release notes
## Release date: July 20th, 2018

This is the first major version increment during the TestNet beta phase. It includes lots of fixes and significantly improved network stability and flow between nodes. 

## New features and fixes:
- Network fixes
- OT flow fixes (challenges, etc.)
- Improved logging
- Improved docker image
- Auto-update fixes
- Houston features
- Increased replication
---

## V1.0b “Apollo” release notes (29/06/2018)
# V1.0b “Apollo” release notes
## Release date: June 290th, 2018

Apollo is the first beta version of the testnet protocol and implements all the features set for development. With the growing usage of the protocol and identified improvement proposals, we will be moving towards a mainnet launch in Q3.


## New features and fixes:
- Exposed API for local node operations
- Upgraded and improved network read flow
- New version of documentation at http://docs.origintrail.io
- Several bugs fixed
---

## V1.0b-RC “Lunar Orbiter” release notes (18/06/2018)
# V1.0b-RC “Lunar Orbiter” release notes
## Release date: June 18th, 2018

### The Lunar Orbiter release
Lunar Orbiter takes the alpha phase to the finish line nicely by implementing two final important improvements: the latest version of the payment mechanism, and version two of the zero-knowledge privacy layer logic. The payment mechanism is now extended to support the ability to perform trustless, monetized data reading from the OriginTrail Decentralized Network (ODN). In this way, the data creator (DC) and data holder (DH) nodes will be able to charge a fee from data viewer (DV) nodes, which would read data from them in order to provide them with the requested data. 

## New features:
- V2 of consensus check with privacy layer (zk) 
- V2 of payment mechanism with testnet tokens 
- Standardized namespaces in XML
- Kademlia security improved
- Separated import form replication
- Updated Smart Contracts
- Developed large number of test XML files

## Fixes: 
- Eclipse bugs resolved
- Added license to repository
- Improved tests and CI execution time reduced 
- Additional refactoring of the code
- Increased test coverage
- Numerous small fixes
---

## V0.9.0a “Explorer” release notes (04/06/2018)
# V0.9.0a “Explorer” release notes
## Release date: June 4th, 2018

### The Explorer release
Explorer now supports more features on the privacy layer which includes the zero-knowledge algorithm published a month ago in Zond. It brings the ability to handle private data within the system in such a way that the owner can retain control of the information by their DC (data creator) node, while publishing cryptographic commitments in the system to the DH (data holder) nodes involved in replication. 

Our data importer now supports the "Web of Things" (WoT) standard developed by the  World Wide Web Consortium (W3C). It is a first major step towards IoT support and one of the major requirements as a consequence of the first use cases, our partners and community. 

## New features:
- Improved privacy layer implementation 
- Web of Things model supported by our data importer
- New version of Houston (GUI) with data graph visualisation and improved interface
- Remote control API improvement
- IoC implementation in the code

## Fixes: 
- Importer error handling fixes
- Better organisation of the code and refactoring of the singletone classes - IoC
- Improved blockchain tests - truffle test suite
- Additional refactoring of the code
- Increased test coverage
---

## V0.8.0a “Surveyor” release notes (04/06/2018)
# V0.8.0a “Surveyor” release notes
## Release date: May 21st, 2018

### The Surveyor release introduces:
- an improved version of the bidding mechanism and
- the first version of the long awaited consensus check which utilizes the zero-knowledge privacy layer we have been working on in the previous releases.

## New features:
- More efficient bidding on agreements for nodes
- Consensus check on top of zero-knowledge privacy layer allows validating the observed supply chain 
- Remote control API improvement
- Created new smart contract for Bidding
- Improved initial configuration verification

## Fixes: 
- Several configuration bugs
- More verbose error reporting
- Additional refactoring of the code
- Increased test coverage and started integration tests
---

## V0.7.0a “Zond” release notes (07/05/2018)
# V0.7.0a “Zond” release notes
## Release date: May 7th, 2018

### The Zond release introduces:
- A standardized and documented OriginTrail graph ontology structure and compatibility with the Neo4j graph database. This compatibility enhances the flexibility in the data layer as it allows for selecting more than one underlying database system. Neo4j is a graph database platform that powers many of today's mission-critical enterprise applications, including artificial intelligence, fraud detection and recommendations. It is used by companies such as Microsoft, Walmart, Ebay, Airbnb, Volvo, Cisco, Microsoft, LinkedIn, UBS, novo nordisk, and many others. 
- The first version of the zero-knowledge privacy protocol for sharing sensitive data in an encrypted, but publicly verifiable form. This makes the OriginTrail protocol more attractive to companies who would like the competitive advantage of increased transparency and efficiency in their supply chains.

## New features:
- First iteration of Zero knowledge validation algorithm 
- Neo4J Compatibility 
- Implementation of new graph ontology 
- First version of UI 
- Created new smart contract for Bidding
- Created initial configuration verification - balance on wallet etc. 

## Fixes: 
- GS1 Importer refactoring
- Completely refactored node communication flow in the bidding mechanism
- Fixed timed events and updated to work on Smart contract events
- Increased test coverage
---

## V0.6.0a “Kosmos” release notes (23/04/2018)
# V0.6.0a “Kosmos” release notes
## Release date: April 23rd, 2018

Kosmos release brings three vital improvements to the system. They are: 
  
- Full GS1 standards validation: We have improved the GS1 import integration experience by adding full GS1 data validation. This helps speed up integrations.
- The first implementation of the market bidding mechanism. 
- Fully implemented blockchain fingerprinting virtualization documentation, which explains how the blockchain layer of the protocol will become compatible with blockchains other than Ethereum. 

## New features:
- Implemented first version of bidding mechanism covering the full flow - offer broadcast, sending bids, offer reveal and choose
- Finished abstraction of blockchain interface
- Finished GS1 import validation with error reporting
- Created new smart contract for Bidding

## Fixes: 
- Improved unit tests coverage of the code to 80% of covered modules
- Separated logic for DC and DH in the code 
- Implemented sequelize ORM instead of raw queries to majority of database calls
- Reintroduced dotenv for easier initial configuration
- Improved network module - several bugs fixed in Kademlia implementation
- Polished and improved refactoring of the code done in previous release



---

## V0.5.0a “Ranger” release notes (09/04/2018)
# V0.5.0a “Ranger” release notes
## Release date: April 9th, 2018

This release introduces a generalized graph structure document that is able to cover a wide range of use cases. We had a major update of the graph logic based on usage insights and partner companies' suggestions. 

We also implemented a more advanced challenging mechanism (DC sending challenges to DH) and improved payment mechanism that allows DH to pick up the agreement fee anytime with a single transaction. 

Above all we did a major refactoring of the code making it much more scalable and production ready.  A new improved version of Kademlia protocol was implemented, including numerous protections to mitigate DoS, Sybil and Eclipse attacks. We introduced better organization of the database and switched full messaging from API to Kademlia direct messages. 

## New features:
- [Documented Graph structure](https://github.com/OriginTrail/ot-node/wiki/Graph-structure-in-OriginTrail-Data-Layer---version-1.0)
- Improved payment mechanism
- Full Kademlia implementation
- DoS protection
- Sybil and Eclipse attacks protection
- Automatic NAT traversal
- Cryptographic Identities
- RSA keys generation and HTTPS transport for Kademlia
- Reduced number of servers to only one (change from IPC + RPC to just OT node)
- Possibility to connect several nodes 
- Introduced SQLite instead of MongoDB for System storage including database agnostic interface
- Database migrations
- Transaction Queue
- Improved unit tests coverage of the code

## Fixes: 
- Transaction collisions fixed
- Major refactor of the code
- Most functions documented in the code (docblocks)
- Better logging system
- Many of deprecated packages have been replaced 

### NOTE: This release brings many breaking changes so the *installation instructions* will be updated in the following days!


---

## V0.4.0a “Mechta” release notes (26/03/2018)
# V0.4.0a “Mechta” release notes
## Release date: March 12th, 2018

The second release in March features the fully compliant GS1 standard importer as well as documented incentivisation system and taxonomy of different network entities that can be found on our Wiki [here](https://github.com/OriginTrail/ot-node/wiki/OriginTrail-Incentive-model-v1). 

Apart from GS1 standard importer, as a major milestone, this release should be considered as an intermediate release used for the purposes of conceptualising the full incentivisation model that will be implemented during the following releases. 

This release also brings a lot of improvements for our contributors like major cleanup of the source code, most important methods covered with unit tests as well as eslint standards completely defined and code properly linted.

## New features:
- Fully GS1 standard compliant importer
- [Documented incentive model](https://github.com/OriginTrail/ot-node/wiki/OriginTrail-Incentive-model-v1)
- Significantly improved unit tests coverage of the code
- Database tests
- Code is completely linted

## Fixes: 
- Fixed transaction bugs
- Fixed RPC start bug on OSX
- Refactoring of utilities and several other classes
- Integration of Eslint to TravisCI


---

## V0.3.0a “Luna” release notes (12/03/2018)
# V0.3.0a “Luna” release notes
## Release date: March 12th, 2018

The first release in March features the first test compensation system with alpha tokens on the Ethereum Rinkeby test network. Utilizing a custom designed TAR scheme (“Test-Answer-Receipt” protocol) it allows for random checks on the availability of OT services and data provided by the DH (data holder) nodes, according to the predefined “deal” (service conditions, price, and longevity). The compensation is handled according to the results of the checks and allows the DH node to independently collect tokens from a Service escrow smart contract. 

The node installation instructions can be found [here](https://github.com/OriginTrail/ot-node/wiki/Integration-Instructions). Alpha tokens can be obtained by request from our team at support@origin-trail.com - send us your Rinkeby wallet addresses and our team will forward you the test tokens. For the future versions, we plan on implementing a token faucet.

This release should be considered as an intermediate release used for the purposes of experimentation and for determining the appropriate token compensation mechanisms.

## New features:

- Initial payment mechanism using Alpha test token on __Rinkeby network__, utilizing an Escrow smart contract
- Signed compensation receipts and payout method
- Graph hashing using Merkle trees, improved by utilizing one fingerprint per import
- Updated XML importer and XML structure according to business needs to be observed in pilots
- Introduced JSON file importer for replication
- Node vertices encryption utilizing RSA
- Automated (proto) Proof-of-Service testing based on random checks and TAR protocol
- Usage of __MongoDB__ for storing session data
- Using uPnP port forwarding for nodes behind NAT
- Various interface improvements - both servers (IPC and RPC) can be started with the single command `npm start`, for new versions of the node you will be able to automatically update it just by running `node update`, increased verbosity of terminal messages and logging into the file `log.log`, etc. 


## Notes:

- The current prototype doesn’t support full replication yet. Currently, there’s one DH node associated per each DC node, for testing purposes, while further improvements are coming with [Ranger and Kosmos](https://origintrail.io/roadmap) releases.
- Additionally, the next release ([Mechta](https://origintrail.io/roadmap)) will feature Kadence instead of Kad and Quasar because of their depreciation, as well as to address the NAT port forwarding issue

## Known issues:

- Currently, messages between DC (data creator) and DH (data holder) are not signed so Sybil attacks are possible. This will be addressed in [Ranger](https://origintrail.io/roadmap) release
- The DH node does not automatically verify that the escrow was created, which puts DC in a favorable position. This will be addressed by the [Kosmos](https://origintrail.io/roadmap) release
- Implemented uPnP NAT port forwarding functions only if the node is behind one router, but not behind chained multiple routers, and if the router has a public IP address.
- Minimum RAM for install process is 1GB, on servers with __512MB__ or less, a swap file is needed
