Feature: Permissioned data features
  Background: Setup local blockchain and bootstraps
    Given the blockchains are set up
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
    And I use 2nd node as DH
    When DH exports the last imported dataset as OT-JSON
    And DH waits for export to finish
    Then The last export doesn't have permissioned data
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

  @second
  Scenario: Remove permissioned data and initiates purchase request
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
    Given DC removes permissioned data from the last imported dataset consisting of path: "id", value: "urn:ot:object:actor:id:company-red"
    When DC exports the last imported dataset as OT-JSON
    And DC waits for export to finish
    Then the last exported dataset should not contain permissioned data as "urn:ot:object:actor:id:company-red"
    And DV unsuccessfully gets the price for the last imported dataset
    Then DV unsuccessfully initiates purchase for the last imported dataset

  @manual
  Scenario: Permissioned data system complete test
    Given I setup 6 nodes
    And I start the nodes
    And I use 1st node as DC
    And I use 2nd node as DH
    And I use 5th node as DV
    And I use 6th node as DV2
    And I stop [5, 6] nodes
    And DC imports "importers/use_cases/marketplace/permissioned_data_simple_sample.json" as OT-JSON
    And DC waits for import to finish
    Given DC initiates the replication for last imported dataset
    And I wait for 30 seconds
    And DC whitelists DH for object id: "urn:ot:object:actor:id:company-red" in the last imported dataset
    And DC whitelists DV for object id: "urn:ot:object:actor:id:company-red" in the last imported dataset
    And I wait for replications to finish
    When DH exports the last imported dataset as OT-JSON
    And DH waits for export to finish
    Then the last exported dataset should contain permissioned data as "urn:ot:object:actor:id:company-red"
    Given I use 3rd node as DH
    When DH exports the last imported dataset as OT-JSON
    And DH waits for export to finish
    Then the last exported dataset should not contain permissioned data as "urn:ot:object:actor:id:company-red"
    Given I start the 5th node
    And I start the 6th node
    Given DV publishes query consisting of path: "id", value: "urn:ot:object:actor:id:company-red" and opcode: "EQ" to the network
    And all nodes with last import should answer to last network query by DV
    When the DV purchases last import from the last query from the DC
    And DV waits for import to finish
    And DV exports the last imported dataset as OT-JSON
    And DV waits for export to finish
    Then the last exported dataset should contain permissioned data as "urn:ot:object:actor:id:company-red"
    Given DV2 publishes query consisting of path: "id", value: "urn:ot:object:actor:id:company-red" and opcode: "EQ" to the network
    And all nodes with last import should answer to last network query by DV2
    When the DV2 purchases last import from the last query from the DC
    And DV2 waits for import to finish
    And DV2 exports the last imported dataset as OT-JSON
    And DV2 waits for export to finish
    Then the last exported dataset should not contain permissioned data as "urn:ot:object:actor:id:company-red"
    Given DV2 gets the list of available datasets for trading
    And DV2 gets the price for the last imported dataset
    And DV2 initiates purchase for the last imported dataset and waits for confirmation
    And DV2 waits for purchase to finish
    When DV2 exports the last imported dataset as OT-JSON
    And DV2 waits for export to finish
    Then the last exported dataset should contain permissioned data as "urn:ot:object:actor:id:company-red"
