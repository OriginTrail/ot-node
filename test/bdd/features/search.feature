# Proposed by Bello
Feature: Searching for assets on the DKG

    Scenario: Search for an entity with an existing keyword
        Given I search for an entity with one of its existing keywords:
            | keyword 1 |
        When I call entities search result with the given handler id
        Then I will get the assertion id for the matching dataset
        And If I call resolve route with the assertion id
        Then I will get the handler id for the dataset
        And If I call resolve result with the handler id
        Then I will get the dataset containing the intial keyword:
            | keyword 1 |

    Scenario: Search for an entity with a non-existent keyword
        Given I search for an entity with a keyword that does not match any asset on the DKG
        When I call entities search result with the given handler id
        Then I will get an empty itemListElement

    Scenario: Search for an assertion with an existing keyword
        Given I perform an assertion search with an existing keyword:
            | keyword 1 |
        When I call assertion search result with the given handler id
        Then I will get the dataset containing the intial keyword:
            | keyword 1 |

    Scenario: Search for an assertion with a non-existent keyword
        Given I perform an assertion search with a keyword that does not match any asset on the DKG
        When I call assertion search result with the given handler id
        Then I will get an empty itemListElement

# Proposed by Ana
Feature: Searching and querying for an assertion on the DKG

    @ana
    Scenario: Create an asset with keyword
        Given I setup 4 nodes in my local env
        When I create an asset with keyword
            | keyword |
        Then I send resolve request
        And I wait resolve result status to be COMPLETED

    @ana
    Scenario: Searching the assertion by keyword
        Given the assertion is successfully inserted to the nodes
        When I search DKG by keyword
            | keyword |
        Then the result of assertion search cannot be 0
        And the search result should be valid

    @ana
    Scenario: Querying the assertion by keyword on the DKG
        Given query request is send for the keyword
            | keyword |
        When the query result status is COMPLETED
        Then the query result response data should contain triplets
        And data integrity can be validate using triplet value
            | triplet |
        And root hash should matched
