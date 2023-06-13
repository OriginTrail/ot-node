Feature: Get errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  @get-errors
  Scenario: Getting non existent UAL
    Given I setup 4 nodes
    And I wait for 2 seconds
    
    When I call Get directly on the node 1 with nonExistentUAL
    And I wait for latest resolve to finalize
    Then Latest Get operation finished with status: GetRouteError
