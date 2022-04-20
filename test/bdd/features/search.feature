Feature: Searching for assets on the DKG

    Scenario: Create an asset with keyword
        Given I setup 4 nodes in my local env
        When I create an asset with keyword
            | keyword |
        Then I send resolve request
        And I wait resolve result status to be COMPLETED

    Scenario: Search for an entity with an existing keyword
        Given the assertion is successfully inserted to the nodes
        Given I search for an entity with one of its existing keywords:
            | keyword |
        When I retrieve entity result with the given handler id
        Then I get the assertion id for the matching dataset
        And If I resolve the assertion id
        Then I will get the handler id for the dataset
        And If I resolve result with the handler id
        Then the result of assertion search cannot be 0
        And the search result should be valid
        And I will get the dataset containing the intial keyword:
            | keyword |
        And I will see the number of nodes that responded
        And I will see the number of assets that retrieved

    Scenario: Search for an entity with a non-existent keyword
        Given I search for an entity with a keyword that does not match any asset on the DKG
        When I retrieve entities search result with the given handler id
        Then I will get an empty itemListElement

    Scenario: Search for an assertion with an existing keyword
        Given I search for an assertion with an existing keyword:
            | keyword |
        When I retrieve assertion result with the given handler id
        Then I will get the dataset containing the intial keyword:
            | keyword |

    Scenario: Search for an assertion with a non-existent keyword
        Given I search for an assertion with a keyword that does not match any asset on the DKG
        When I retrieve assertion result with the given handler id
        Then I will get an empty itemListElement


