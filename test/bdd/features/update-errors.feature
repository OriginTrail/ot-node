Feature: Update errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  @update-errors
  Scenario: Update knowledge asset that was not previously published
    Given I setup 1 node
    And I wait for 2 seconds

    When I call Update directly on the node 1 with validUpdateRequestBody
    And I wait for latest Update to finalize
    Then Latest Update operation finished with status: ValidateAssetError

