Feature: Release related tests
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  @release
  Scenario: Publishing a valid assertion
    Given I set R0 to be 1
    And I set R1 to be 2
    And I setup 4 nodes
    And I wait for 2 seconds

    When I call Publish on the node 4 with validAssertion
    And I wait for latest Publish to finalize
    Then Latest Publish operation finished with status: COMPLETED
