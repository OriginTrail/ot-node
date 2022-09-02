Feature: Get errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  @get-errors
  Scenario: Node is not able to get assertion with assertionID
    Given I setup 4 nodes
    And I call get directly to ot-node 1 with unpublishedAssertionId
    And I wait for last resolve to finalize
    And Last operation finished with status: GetAssertionIdError
    