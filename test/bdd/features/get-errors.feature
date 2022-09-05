Feature: Get errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  @get-errors
  Scenario: Getting non existent UAL
    Given I setup 4 nodes
    And I call get directly to ot-node 1 with nonExistentUAL
    And I wait for last resolve to finalize
    And Last GET operation finished with status: GetAssertionIdError

#  @get-errors
#  Scenario: Node is not able to get assertion with assertionID
#    Given I setup 4 nodes
#    When I call publish on node 1 with validAssertion
#    And Last PUBLISH operation finished with status: COMPLETED
#    And I call get directly to ot-node 1 with lastPublishedAssetUAL
#    And I wait for last resolve to finalize
#    And Last GET operation finished with status: GetLocalError

