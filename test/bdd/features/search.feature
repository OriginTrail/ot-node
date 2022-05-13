Feature: Searching for assets on the DKG
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  Scenario: Publish and search assertion on the network with keywords
    Given I setup 4 nodes
    When I call publish on node 1 with validAssertion with keywords:
      | keyword 1 | keyword 2 |
    And I wait for last publish to finalize
    And Last publish finished with status: COMPLETED
    Given I call search request on node 1 with validAssertion for the keywords:
      | keyword 1 | keyword 2 |
    And I wait searching request to be finalized
    Then The result of assertion search cannot be 0
    And The search result should contain all valid data
    And I get the metadata which contains the keywords:
      | keyword 1 | keyword 2 |
    And The number of nodes that responded cannot be 0


