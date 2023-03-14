Feature: Update asset test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  @release
  Scenario: Update an existing asset
    Given I set R0 to be 1
    Given I set R1 to be 2
    Given I setup 4 nodes
    And I wait for 10 seconds
    When I call publish on node 4 with validPublish_1ForUpdate_1
    Then Last Publish operation finished with status: COMPLETED
    Given I call update on node 4 for last publish UAL with validUpdate_1
    When Last Update operation finished with status: COMPLETED
