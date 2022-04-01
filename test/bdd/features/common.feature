Feature: Smoke test

  Scenario: Check that info route is accessible and it returns correct values
    Given I setup 1 node
    And I call info route successfully
