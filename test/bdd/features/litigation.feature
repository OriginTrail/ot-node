Feature: Test various litigation scenarios
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @third
  Scenario: Test litigation for one holder which is not responding
    Given the replication difficulty is 0
    And I setup 8 node
    And I override configuration for all nodes
      | dc_holding_time_in_minutes | 5 |
      | numberOfChallenges | 100 |
      | challengeResponseTimeMills | 5000 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Then DC's last import's hash should be the same as one manually calculated
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    Then the last root hash should be the same as one manually calculated
    Then the last import should be the same on all nodes that replicated data
    And I wait for challenges to start
    And I corrupt 1st holder's database ot_vertices collection
    And I wait for litigation initiation
    And I corrupt 2nd holder's database ot_vertices collection
    Then Litigator should delay other litigations while one is running
    Then 1st holder to litigate should answer litigation
    Then Litigator node should have completed litigation
    Then 1st started holder should have been penalized
    Then Litigator should have started replacement for penalized holder
    Then I wait for 4 replacement replications to finish
    Then I wait for replacement to be completed
    Then 2nd holder to litigate should answer litigation
    Then Litigator node should have completed litigation
    Then 2nd started holder should have been penalized
    Then Litigator should have started replacement for penalized holder
    Then I wait for 3 replacement replications to finish
    Then I wait for replacement to be completed

  @third
  Scenario: Test litigation for one holder which has failed to answer challenge but succeeded to answer litigation (wrongly)
    Given the replication difficulty is 0
    And I setup 7 node
    And I override configuration for all nodes
      | dc_holding_time_in_minutes | 5 |
      | numberOfChallenges | 100 |
      | challengeResponseTimeMills | 5000 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Then DC's last import's hash should be the same as one manually calculated
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    Then the last root hash should be the same as one manually calculated
    Then the last import should be the same on all nodes that replicated data
    And I wait for challenges to start
    And I corrupt 1st holder's database ot_vertices collection
    And I wait for litigation initiation
    Then 1st holder to litigate should answer litigation
    Then I wait for 3 replacement replications to finish
    Then I wait for replacement to be completed

  @third
  Scenario: Test litigation for one holder which has failed to answer challenge but succeeded to answer litigation (correctly)
    Given the replication difficulty is 0
    And I setup 7 node
    And I override configuration for all nodes
      | dc_holding_time_in_minutes | 5 |
      | numberOfChallenges | 100 |
      | challengeResponseTimeMills | 5000 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Then DC's last import's hash should be the same as one manually calculated
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    Then the last root hash should be the same as one manually calculated
    Then the last import should be the same on all nodes that replicated data
    And I wait for challenges to start
    And I stop 1 holder
    And I remember stopped holders
    And I wait for litigation initiation
    And I start 1st stopped holder
    Then 1st holder to litigate should answer litigation
    Then Litigator node should have completed litigation
    Then 1st started holder should not have been penalized

  @third
  Scenario: Test litigation case where same new nodes will apply for same offer
    Given the replication difficulty is 0
    And I setup 4 nodes
    When I override configuration for all nodes
      | dc_holding_time_in_minutes | 7 |
      | numberOfChallenges | 100 |
      | challengeResponseTimeMills | 5000 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And I wait for challenges to start
    # Meanwhile add 2 more nodes
    Given I additionally setup 3 nodes
    And I start additional nodes
    # Stop the 3rd node who got the deal and and produce litigation
    When I corrupt 1st holder's database ot_vertices collection
    And I wait for litigation initiation
    Then I wait for 3 replacement replications to finish
    Then I wait for replacement to be completed

  @fourth
  Scenario: Test litigation case
    Given the replication difficulty is 0
    And I setup 4 nodes
    When I override configuration for all nodes
      | dc_holding_time_in_minutes | 5 |
      | numberOfChallenges | 1 |
      | challengeResponseTimeMills | 5000 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Given DC initiates the replication for last imported dataset
    And I wait for 4th node to verify replication
    And I stop the 4th node
    And I wait for replications to finish
    When I wait for litigation initiation
    And I simulate true litigation answer for 4th node
    Then the last offer's status for 4th node should be active
