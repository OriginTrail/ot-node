Feature: API endpoints features
  Background: Setup local blockchain and bootstraps
    Given the blockchains are set up
    And 1 bootstrap is running

  @first
  Scenario: Simple consensus check
    Given I setup 2 node
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    When DC exports the last imported dataset as OT-JSON
    And DC waits for export to finish
    And I use 2nd node as DC
    And DC imports "importers/xml_examples/Retail/02_Green_to_Pink_receipt.xml" as GS1-EPCIS
    And DC waits for import to finish
    When DC exports the last imported dataset as OT-JSON
    And DC waits for export to finish
    Then the consensus check should pass for the two last imports

  @skip
  Scenario: API calls should be forbidden
    Given I setup 1 node
    And I override configuration for all nodes
      | network.remoteWhitelist | 100.100.100.100 | 200.200.200.200 |
    And I start the node
    And I use 1st node as DC
    Then API calls will be forbidden

  @skip
  Scenario: API calls should not be authorized
    Given I setup 1 node
    And I override configuration for all nodes
      | auth_token_enabled | true |
    And I start the node
    And I use 1st node as DC
    Then API calls will not be authorized


  @second
  Scenario: Simple ZK quantity check
    Given I setup 1 node
    And I start the nodes
    And I use 1st node as DC
    And DC imports "test/modules/test_xml/Transformation.xml" as GS1-EPCIS
    And DC waits for import to finish
    Then the custom traversal from "sgtin" "urn:epc:id:sgtin:8635411.000333.00001" with connection types "EPC,INPUT_EPC,OUTPUT_EPC" should contain 3 objects
    And zk check should pass