Feature: Protocol related issues.

  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  Scenario: Expect publish to work with ghost nodes.
    # Use 7 nodes in total - Kadence.APLHA(3) times two plus one DC.
    Given I setup 7 nodes
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Then DC's last import's hash should be the same as one manually calculated
    # Stop the node to avoid replication.
    When I stop the 7th node
    # Start replication to force DC to write fingerprint so DV can buy it. Do not wait to finish.
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    Then the last root hash should be the same as one manually calculated
    Then the last import should be the same on all nodes that replicated data
    When I stop [2, 3, 4, 5] nodes
    And I start the 7th node
    And I use 7th node as DV
    Given DV publishes query consisting of path: "identifiers.id", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ" to the network
    And the DV purchases import from the last query from the DC
    Then the last import should be the same on DC and DV nodes
