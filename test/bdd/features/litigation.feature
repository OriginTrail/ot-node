Feature: Test various litigation scenarios
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @first
  Scenario: Test litigation for one holder which has failed to answer challenge but succeeded to answer litigation (wrongly)
    Given the replication difficulty is 1
    And I setup 4 nodes
    And I override configuration for all nodes
      | dc_holding_time_in_minutes | 5 |
      | numberOfChallenges | 100 |
      | challengeResponseTimeMills | 5000 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And I wait for challenges to start
    And I corrupt 1st holder's database ot_vertices collection
    And I wait for litigation initiation
    Then 1st holder to litigate should answer litigation
    Then Litigator node should have completed litigation
    Then 1st started holder should have been penalized

  @third
  Scenario: Test litigation for one holder which has failed to answer challenge but succeeded to answer litigation (correctly)
    Given the replication difficulty is 1
    And I setup 4 node
    And I override configuration for all nodes
      | dc_holding_time_in_minutes | 5 |
      | numberOfChallenges | 100 |
      | challengeResponseTimeMills | 5000 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    Given DC initiates the replication for last imported dataset
    And DC waits for last offer to get written to blockchain
    And I wait for replications to finish
    And I wait for challenges to start
    And I stop 1 holder
    And I remember stopped holders
    And I wait for litigation initiation
    And I start 1st stopped holder
    Then 1st holder to litigate should answer litigation
    Then Litigator node should have completed litigation
    Then 1st started holder should not have been penalized

  @skip #to be done when we finish replacement
  Scenario: Test litigation case where same new nodes will apply for same offer
    Given the replication difficulty is 1
    And I setup 4 nodes
    When I override configuration for all nodes
      | dc_holding_time_in_minutes | 7 |
      | numberOfChallenges | 100 |
      | challengeResponseTimeMills | 5000 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    Given DC initiates the replication for last imported dataset
    And DC waits for last offer to get written to blockchain
    And I wait for replications to finish
    And I wait for challenges to start
    When I corrupt 1st holder's database ot_vertices collection
    And I wait for litigation initiation
    Then Litigator node should have completed litigation
    Then 1st started holder should have been penalized

  @first
  Scenario: DC should discriminate DH which has reputation lower than threshold
    Given the replication difficulty is 1
    And I setup 5 nodes
    And I override configuration for all nodes
      | dc_holding_time_in_minutes | 10 |
      | numberOfChallenges | 100 |
      | challengeResponseTimeMills | 5000 |
      | dh_min_reputation | 0 |
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    Given DC initiates the replication for last imported dataset
    And DC waits for last offer to get written to blockchain
    And I wait for replications to finish
    And I corrupt 1st holder's database ot_vertices collection
    When I wait for litigation initiation
    Then Litigator node should have completed litigation
    When DC imports "importers/xml_examples/Retail/02_Green_to_Pink_receipt.xml" as GS1-EPCIS
    And DC waits for import to finish
    Given DC initiates the replication for last imported dataset
    And DC waits for last offer to get written to blockchain
    And I wait for replications to finish
    Then Corrupted node should not have last replication dataset
