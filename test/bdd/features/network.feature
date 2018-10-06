Feature: Test network
  Background: Setup blockchain
    Given the blockchain is set up
    And 1 bootstrap is running

  Scenario: Nesto
    Given I setup 5 nodes
    And I start the nodes
    Then everything should be without the errors

  Scenario: Nesto drugo
    Given I wait for 1 second
