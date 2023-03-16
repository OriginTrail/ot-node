Feature: Update errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  @update-errors
  Scenario: Update asset that was not previously published
    Given I setup 1 nodes
    And I call publish on node 1 with validAssertion
    Then Last Publish operation finished with status: PublishStartError

  @update-errors
  Scenario: Publish an asset directly on the node
    Given I setup 1 nodes
    And I call update on ot-node 1 directly with validUpdateRequestBody
    And I wait for last update to finalize
    Then Last Update operation finished with status: ValidateAssetError
#
#

