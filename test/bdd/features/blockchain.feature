Feature: Data layer related features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @third
  Scenario: Check that updating the Holding contract doesn't make payouts fail
    Given I setup 4 nodes
    And I override configuration for all nodes
      | dc_holding_time_in_minutes | 2 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/sample_files/DC1_01-sample_product_packing.xml" as GS1-EPCIS
    And DC waits for import to finish
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    When I deploy a new Holding contract
    And DC waits for holding time
    Then selected DHes should be payed out

  @fourth
  Scenario: Check that updating the Holding contract doesn't make an offer fail
    Given I setup 4 nodes
    And I override configuration for all nodes
      | dc_holding_time_in_minutes | 2 |
      | dc_choose_time | 180000 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/sample_files/DC1_01-sample_product_packing.xml" as GS1-EPCIS
    And DC waits for import to finish
    Given DC initiates the replication for last imported dataset
    And I wait for 15 seconds
    When I set the Holding contract as OldHolding
    And I deploy a new Holding contract
    And I wait for replications to finish
    And DC waits for holding time
    Then selected DHes should be payed out
