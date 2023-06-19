Feature: Get asset states test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  @release
  Scenario: Get first state of the updated knowledge asset
    Given I set R0 to be 1
    And I set R1 to be 2
    And I set finalizationCommitsNumber to be 2
    And I setup 4 nodes
    And I wait for 2 seconds

    When I call Publish on the node 4 with validPublish_1ForValidUpdate_1
    And I wait for latest Publish to finalize
    Then Latest Publish operation finished with status: COMPLETED

    When I call Update on the node 4 for the latest published UAL with validUpdate_1
    And I wait for latest Update to finalize
    Then Latest Update operation finished with status: COMPLETED

    When I call Get directly on the node 4 with validGetFirstStateRequestBody
    And I wait for latest resolve to finalize
    Then Latest Get operation finished with status: COMPLETED

  @release
  Scenario: Get latest state of the updated knowledge asset
    Given I set R0 to be 1
    And I set R1 to be 2
    And I set finalizationCommitsNumber to be 2
    And I setup 4 nodes
    And I wait for 2 seconds

    When I call Publish on the node 4 with validPublish_1ForValidUpdate_1
    And I wait for latest Publish to finalize
    Then Latest Publish operation finished with status: COMPLETED

    When I call Update on the node 4 for the latest published UAL with validUpdate_1
    And I wait for latest Update to finalize
    Then Latest Update operation finished with status: COMPLETED

    When I call Get directly on the node 4 with validGetUpdatedStateRequestBody
    And I wait for latest resolve to finalize
    Then Latest Get operation finished with status: COMPLETED

  @release
  Scenario: Get all states of the knowledge asset that is updated 2 times
    Given I set R0 to be 1
    And I set R1 to be 2
    And I set finalizationCommitsNumber to be 2
    And I setup 4 nodes
    And I wait for 2 seconds

    When I call Publish on the node 4 with validPublish_1ForValidUpdate_1
    And I wait for latest Publish to finalize
    Then Latest Publish operation finished with status: COMPLETED

    When I call Update on the node 4 for the latest published UAL with validUpdate_1
    And I wait for latest Update to finalize
    Then Latest Update operation finished with status: COMPLETED

    When I call Update on the node 4 for the latest published UAL with validUpdate_2
    And I wait for latest Update to finalize
    Then Latest Update operation finished with status: COMPLETED

    When I call Get directly on the node 4 with getFirstStateRequestBody
    And I wait for latest resolve to finalize
    Then Latest Get operation finished with status: COMPLETED

    When I call Get directly on the node 4 with getSecondStateRequestBody
    And I wait for latest resolve to finalize
    Then Latest Get operation finished with status: COMPLETED

    When I call Get directly on the node 4 with getThirdStateRequestBody
    And I wait for latest resolve to finalize
    Then Latest Get operation finished with status: COMPLETED
