Feature: Test basic network features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @fourth
  Scenario: Test replication DC -> DH
    Given the replication difficulty is 0
    And I setup 5 nodes
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    Then DC's last import's hash should be the same as one manually calculated
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    Then the last root hash should be the same as one manually calculated
    Then the last import should be the same on all nodes that replicated data

  @first
  Scenario: Test failing replication DC -> DH
    Given the replication difficulty is 0
    And I setup 2 nodes
    And I override configuration for all nodes
      | dc_choose_time | 60000 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    Then DC's last import's hash should be the same as one manually calculated
    Given DC initiates the replication for last imported dataset
    And I wait for DC to fail to finalize last offer
    Given I wait for 5 seconds
    Then Last replication should fail

  @skip
  Scenario: DC->DH->DV replication + DV network read + DV purchase
    Given the replication difficulty is 0
    And I setup 5 nodes
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    Then DC's last import's hash should be the same as one manually calculated
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    Then the last import should be the same on all nodes that replicated data
    Given I additionally setup 1 node
    And I start additional nodes
    And I use 6th node as DV
    Given DV publishes query consisting of path: "identifiers.id", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ" to the network
    Then all nodes with last import should answer to last network query by DV
    Given the DV purchases last import from the last query from a DH
    And DV waits for import to finish
    When DC exports the last imported dataset as OT-JSON
    And DC waits for export to finish
    When DV exports the last imported dataset as OT-JSON
    And DV waits for export to finish
    Then the last import should be the same on DC and DV nodes

  @skip
  Scenario: DV purchases data directly from DC, no DHes
    Given the replication difficulty is 0
    And I setup 3 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    Then DC's last import's hash should be the same as one manually calculated
    Given DC initiates the replication for last imported dataset
    And DC waits for replication window to close
    Given I additionally setup 1 node
    And I start additional nodes
    And I use 4th node as DV
    Given DV publishes query consisting of path: "identifiers.id", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ" to the network
    Then all nodes with last import should answer to last network query by DV
    Given the DV purchases last import from the last query from the DC
    And DV waits for import to finish
    When DC exports the last imported dataset as OT-JSON
    And DC waits for export to finish
    When DV exports the last imported dataset as OT-JSON
    And DV waits for export to finish
    Then the last import should be the same on DC and DV nodes

  @skip
  Scenario: 2nd DV purchases data from 1st DV, no DHes
    Given the replication difficulty is 0
    And I setup 3 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    Then DC's last import's hash should be the same as one manually calculated
    Given DC initiates the replication for last imported dataset
    And DC waits for replication window to close
    Given I additionally setup 1 node
    And I start additional nodes
    And I use 4th node as DV
    Given DV publishes query consisting of path: "identifiers.id", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ" to the network
    Then all nodes with last import should answer to last network query by DV
    Given the DV purchases last import from the last query from the DC
    And DV waits for import to finish
    When DC exports the last imported dataset as OT-JSON
    And DC waits for export to finish
    When DV exports the last imported dataset as OT-JSON
    And DV waits for export to finish
    Then the last import should be the same on DC and DV nodes
    Given I additionally setup 1 node
    And I start additional nodes
    And I use 5th node as DV2
    Given DV2 publishes query consisting of path: "identifiers.id", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ" to the network
    Then all nodes with last import should answer to last network query by DV2
    Given the DV2 purchases last import from the last query from a DV
    And DV2 waits for import to finish
    When DC exports the last imported dataset as OT-JSON
    And DC waits for export to finish
    When DV exports the last imported dataset as OT-JSON
    And DV waits for export to finish
    Then the last import should be the same on DC and DV nodes
    When DC exports the last imported dataset as OT-JSON
    And DC waits for export to finish
    When DV2 exports the last imported dataset as OT-JSON
    And DV2 waits for export to finish
    Then the last import should be the same on DC and DV2 nodes

  @first
  Scenario: DV should be able to publish network query regardless of the funds
    # Start node and let it create own profile. It needs some ETH and TRAC for that.
    Given I setup 1 node
    And I start the node
    And I stop the node
    # Spend all the funds and try to query network.
    When the 1st node's spend all the Tokens
    And the 1st node's spend all the Ethers
    And I start the node
    And I use 1st node as DV
    Given I additionally setup 3 node
    And I start additional nodes
    When DV publishes query consisting of path: "identifiers.id", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ" to the network
    Then everything should be ok

  @second
  Scenario: Bootstraps should have /api/info route enabled
    Then 1st bootstrap should reply on info route

  @third
  Scenario: DH payout scenario
    Given the replication difficulty is 0
    And I setup 5 nodes
    And I override configuration for all nodes
      | dc_holding_time_in_minutes | 1 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And DC waits for holding time
    Then selected DHes should be payed out

  @fourth
  Scenario: DH with disabled auto-payouts
    Given the replication difficulty is 0
    And I setup 5 nodes
    And I override configuration for all nodes
      | dc_holding_time_in_minutes |   1  |
      | disableAutoPayouts         | true |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And DC waits for holding time
    Then selected DHes should not be payed out

  @first
  Scenario: Node with diff management and operational wallet should successfully start
    Given I setup 1 node
    And I set 1st node's management wallet to be different then operational wallet
    And I start the node
    Then default initial token amount should be deposited on 1st node's profile

  @second
  Scenario: Test repeated offer creation with same dataset
    Given the replication difficulty is 0
    And I setup 3 nodes
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    Then DC's last import's hash should be the same as one manually calculated
    Given DC initiates the replication for last imported dataset
    And I wait for DC to fail to finalize last offer
    Given I additionally setup 1 node
    And I start additional nodes
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish