Feature: API endpoints features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @first
  Scenario: Smoke check /api/consensus endpoint
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    And DC imports "importers/xml_examples/Retail/02_Green_to_Pink_receipt.xml" as GS1
    Given DC calls consensus endpoint for sender: "urn:ot:object:actor:id:Company_Green"
    Then last consensus response should have 1 event with 1 match
    Given DC calls consensus endpoint for sender: "urn:ot:object:actor:id:Company_Pink"
    Then last consensus response should have 1 event with 1 match

  @first
  Scenario: API calls should be forbidden
    Given I setup 1 node
    And I override configuration for all nodes
      | network.remoteWhitelist | 100.100.100.100 | 200.200.200.200 |
    And I start the node
    And I use 1st node as DC
    Then API calls will be forbidden

  @first
  Scenario: API calls should not be authorized
    Given I setup 1 node
    And I override configuration for all nodes
      | auth_token_enabled | true |
    And I start the node
    And I use 1st node as DC
    Then API calls will not be authorized