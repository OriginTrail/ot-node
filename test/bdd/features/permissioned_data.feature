Feature: Permissioned data features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @second
  Scenario: Whitelisted viewer should receive the complete dataset after query
  Given the replication difficulty is 1
  And I setup 4 nodes
  And I start the nodes
  And I use 1st node as DC
  And DC imports "importers/use_cases/marketplace/permissioned_data_simple_sample.json" as OT-JSON
  And DC waits for import to finish
  Given DC initiates the replication for last imported dataset
  And DC waits for replication window to close
  Given I additionally setup 1 node
  And I start additional node
  And I use 5th node as DV
  And DC whitelists DV for object id: "urn:ot:object:actor:id:company-red" in the last imported dataset
  Given DV publishes query consisting of path: "id", value: "urn:ot:object:actor:id:company-red" and opcode: "EQ" to the network
  Then all nodes with last import should answer to last network query by DV
  Given the DV purchases last import from the last query from the DC
  And DV waits for import to finish
  When DC exports the last imported dataset as OT-JSON
  And DC waits for export to finish
  When DV exports the last imported dataset as OT-JSON
  And DV waits for export to finish
  Then the last import should be the same on DC and DV nodes


  @first
  Scenario: Basic purchase scenario where buyer should receive private data while seller should take payment
    Given the replication difficulty is 1
    And I setup 4 nodes
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/use_cases/marketplace/permissioned_data_simple_sample.json" as OT-JSON
    And DC waits for import to finish
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    Given I use 2nd node as DV
    And DV gets the list of available datasets for trading
    And DV gets the price for the last imported dataset
    And DV initiates purchase for the last imported dataset and waits for confirmation
    And DV waits for purchase to finish
#    And DC waits to take a payment
    When DC exports the last imported dataset as OT-JSON
    And DC waits for export to finish
    When DV exports the last imported dataset as OT-JSON
    And DV waits for export to finish
    Then the last import should be the same on DC and DV nodes
