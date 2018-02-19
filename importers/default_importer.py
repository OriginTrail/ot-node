import sys
sys.path.append('./dependencies');
from xmljson import yahoo as parser
from xml.etree.ElementTree import fromstring
from xml.etree.ElementTree import ParseError
from json import dumps, loads
import hashlib
import time

from os.path import join, dirname
from dotenv import load_dotenv

dotenv_path = join(dirname(__file__), '.env')
load_dotenv(dotenv_path)

from arango import ArangoClient

if len(sys.argv) != 2:
    print("Invalid number of arguments, required format: python xmlimporter.py import_file.xml")
    sys.exit()

# Entities
PROVIDERS = {}
LOCATIONS = {}
PRODUCTS = {}
BATCHES = {}
EVENTS = {}

# Relations
OWNED_BY = []
AT = []
SOURCE_BATCH = []
RESULTED_BATCH = []
INSTANCE_OF = [] 
OF_BATCH = [] 
FROM = []
TO = []

# Database connection

config_file = open('config.json').read()
config = loads(config_file)

client = ArangoClient(protocol = 'http',
host = os.environ.get("DB_HOST"),
port = os.environ.get("DB_PORT"),
username = os.environ.get("DB_USERNAME"),
password = os.environ.get("DB_PASSWORD"),
enable_logging = True)

db = client.db('origintrail')
client.grant_user_access('root', 'my_database')

current_graphs = db.graphs()
new_graph = True

for graph in current_graphs:
    if 'origintrail_graph' in graph.values():
        ot_graph = db.graph('origintrail_graph')
        new_graph = False
        break

if new_graph:

    ot_graph = db.create_graph('origintrail_graph')

    # Creating collections
    ot_graph.create_vertex_collection('ot_vertices')

    ot_graph.create_edge_definition(
        name='ot_edges',
        from_collections=['ot_vertices'],
        to_collections=['ot_vertices']
    )

# MD5 hashing function

def hashed(source_string):
   hash_method = hashlib.md5()
   hash_method.update(source_string.encode('utf-8') )
   return hash_method.hexdigest()

# Error display function

def error(error_message):
    print("ERROR: " + error_message)
    sys.exit()



# Insert new node_value

def insert_node(collection, node_value):
    node_value['vertex_type'] = collection
    nodesCollection = db.collection('ot_vertices')

    if nodesCollection.has(node_value['_key']):
        return
    else:
        nodesCollection.insert(dumps(node_value))

# Insert new edge

def insert_edge(collection, edge_value):
    edge_value['_to'] = 'ot_vertices/' + edge_value['_to']
    edge_value['_from'] = 'ot_vertices/' + edge_value['_from']
    edge_value['edge_type'] = collection
    edgesCollection = db.collection('ot_edges')
    
    if edgesCollection.get(edge_value['_key']):
        return
    else:
        edgesCollection.insert(dumps(edge_value))
            
# Collaboration check

def isCollaborationConfirmed(providerId, partnerId):
    return True

TRANSFER_EVENTS = [];

# Loading XML from input file supplied in command line argument
xml_file_url = sys.argv[1];
xml_file = open(xml_file_url, "r") 
xml_data = xml_file.read() 

# Data from import file loaded as dictionary

try:
    import_data = parser.data(fromstring(xml_data))
except ParseError:
    error('Invalid XML file')

if 'OrigintrailExport' not in import_data:
    error("Missing OrigintrailExport element!")
    

OrigintrailExport = import_data['OrigintrailExport']

if 'creationTimestamp' not in OrigintrailExport:
    error('Missing export creation timestamp!')
  
    
creationTimestamp = OrigintrailExport['creationTimestamp']

# Reading provider data
if 'Provider' not in OrigintrailExport:
    error("Missing provider info!")
    
providerData = OrigintrailExport['Provider']

if isinstance(providerData, list):
    error("Multiple provider elements!")

if 'uid' not in providerData:
    error("Missing provider uid!")

providerId = providerData['uid']
 
PROVIDERS[providerId] = {}

if 'data' in providerData:
    PROVIDERS[providerId]['data'] = providerData['data']

PROVIDERS[providerId]['uid'] = providerId

PROVIDERS[providerId]['_key'] = hashed('provider_' + providerId)
PROVIDERS[providerId]['nodekey'] = hashed('provider_' + providerId)

if 'MasterData' not in OrigintrailExport:
    error('Missing Master Data!')


MasterData = OrigintrailExport['MasterData']

if 'EntitiesList' not in MasterData:
    error('Missing EntitiesList in MasterData section!')

EntitiesList = MasterData['EntitiesList']

# Reading partners data

if 'Partners' in EntitiesList:
    
    partnersData = EntitiesList['Partners']
    
    for key, partnerData in partnersData.items():
        if key != 'Partner':
            error('Invalid element ' + key + " provided in Partners section")
        
        if not isinstance(partnerData, list):
            tmp_partner = partnerData
            partnerData = []
            partnerData.append(tmp_partner)
        
        
        for partner in partnerData:
            if 'uid' not in partner:
                error('Missing partner uid!')
            
            partnerIdValue = partner['uid']
            
            if len(partnerIdValue) < 3 or partnerIdValue[0:3] != "ot:": # OriginTrail Data Creator Identificator
                partnerIdValue = providerId + '_p_' + partnerIdValue
        
        
            if not isCollaborationConfirmed(providerId, partnerIdValue):
                error('Collaboration with partner ' + partnerIdValue + ' not confirmed!')
              
            
            PROVIDERS[partnerIdValue] = {}

            if 'data' in partner:
                PROVIDERS[partnerIdValue]['data'] = partner['data']
                    
            PROVIDERS[partnerIdValue]['id'] = partner['uid']
            PROVIDERS[partnerIdValue]['uid'] = partnerIdValue
            PROVIDERS[partnerIdValue]['_key'] = hashed('provider_' + partnerIdValue)
            PROVIDERS[partnerIdValue]['nodekey'] = hashed('provider_' + partnerIdValue)
            
# Reading locations data

if 'Locations' not in EntitiesList:
    error('Missing locations data!')

    
businessLocations = EntitiesList['Locations']

for key, locationData in businessLocations.items():
    
    if key != 'BusinessLocation':
        error('Invalid element ' + key + ' provided in Locations section!')
        
    
    if not isinstance(locationData, list):
        tmp_locationData = locationData
        locationData = []
        locationData.append(tmp_locationData)
        
    for location in locationData:
    
        if 'uid' not in location:
            error('Missing uid for Business Location!')

            
        locationIdValue = location['uid']
           
        
       
            
                
        if 'ownerId' not in location:
            error('Missing owner Id for business location ' + locationIdValue + '!')

            
        ownerIdValue = location['ownerId']
        
        if len(ownerIdValue) < 3 or ownerIdValue[0:3] != 'ot:':
            ownerIdValue = providerId + '_p_' + ownerIdValue
            
        if ownerIdValue not in PROVIDERS:
            error('Owner ' + ownerId['content'] + ' of Business Location ' + locationIdValue + ' not provided in Partners section!')
    
                
        if len(locationIdValue) < 3 or locationIdValue[0:3] != 'ot:': # OriginTrail Business Location Identificator
           locationIdValue = providerId + ':otblid:' + locationIdValue
        
          
        LOCATIONS[locationIdValue] = {}
        
        if 'data' in location:
            LOCATIONS[locationIdValue]['data'] = location['data']
                
        LOCATIONS[locationIdValue]['id'] = location['uid']
        LOCATIONS[locationIdValue]['owner'] = location['ownerId']
        LOCATIONS[locationIdValue]['uid'] = locationIdValue
        LOCATIONS[locationIdValue]['_key'] = hashed('business_location_' + locationIdValue)
        LOCATIONS[locationIdValue]['nodekey'] = hashed('business_location_' + locationIdValue)
        
        OWNED_BY.append({'_to': PROVIDERS[ownerIdValue]['nodekey'], '_from': LOCATIONS[locationIdValue]['nodekey'], '_key': hashed('owns_' + PROVIDERS[ownerIdValue]['nodekey'] + LOCATIONS[locationIdValue]['nodekey'])})


# Reading products data

if 'Products' not in EntitiesList:
    error('Missing products data!')

    
products = EntitiesList['Products']

for key, productData in products.items():
    
    if key != 'Product':
        error('Invalid element ' + key + ' provided in Products section!')
     
    
    if not isinstance(productData, list):
        tmp_productData = productData
        productData = []
        productData.append(tmp_productData)
        
    for product in productData:
    
#        print productData
    
    
        if 'uid' not in product:
            error('Missing uid for Product!')
     
            
        productIdValue  = product['uid']
            
        if len(productIdValue) < 3 or productIdValue[0:3] != 'ot:': # OriginTrail Product Identificator
            productIdValue = providerId + ':otpid:' + productIdValue
            
        if 'allIdentifiers' not in product:
            error('Missing allIdentifiers section for Product ' + product['uid'] + '!')
           
        
        allIdentifiers = product['allIdentifiers']
        
        for key, identifiers in allIdentifiers.items():
            if not isinstance(identifiers, list):
                tmp_identifiers = identifiers
                identifiers = []
                identifiers.append(tmp_identifiers)
            
        PRODUCTS[productIdValue] = {}
        
        if 'data' in product:
            PRODUCTS[productIdValue]['data'] = product['data']
                
        PRODUCTS[productIdValue]['id'] = product['allIdentifiers']
        PRODUCTS[productIdValue]['uid'] = productIdValue
        PRODUCTS[productIdValue]['_key'] =  hashed('product_' + productIdValue)
        PRODUCTS[productIdValue]['nodekey'] = hashed('product_' + productIdValue)
        
        if 'ProductBatch' in product:
            productBatch = product['ProductBatch']
            
            if 'uid' not in productBatch:
                error('uid number not provided for Product Batch!')

                
            batchIdValue = productBatch['uid']
            
            batchIdValue = productIdValue + ":otbid:" + batchIdValue
            
            BATCHES[batchIdValue] = {}
            BATCHES[batchIdValue]['id'] = batchIdValue
            BATCHES[batchIdValue]['_key'] = hashed('product_batch_' + batchIdValue)
            BATCHES[batchIdValue]['nodekey'] = hashed('product_batch_' + batchIdValue)
            
            if 'data' in productBatch:
                BATCHES[batchIdValue]['data'] = productBatch['data']
            
            INSTANCE_OF.append({'_from': BATCHES[batchIdValue]['nodekey'], '_to': PRODUCTS[productIdValue]['nodekey'], '_key': hashed('instance_of_' + BATCHES[batchIdValue]['nodekey'] + PRODUCTS[productIdValue]['nodekey'])})


if 'EventsData' not in OrigintrailExport:
    error('Missing EventsData!')

    
EventsData = OrigintrailExport['EventsData']

if 'EventsList' not in EventsData:
    error('EventsList not provided id EventsData section!')

    
EventsList = EventsData['EventsList']

for eventType, events in EventsList.items():
    
    if not isinstance(events, list):
        tmp_events = events
        events = []
        events.append(tmp_events)
        
    for event in events:
        
        if 'eventId' not in event:
            error('Missing event id!')

            
        eventId = event['eventId']
        
        if 'eventTime' not in event:
            error('Missing event time for event ' + eventId + '!')

            
        if 'eventTimeZoneOffset' not in event:
            error('Missing event time zone offset for event ' + eventId + '!')

            
        eventTimeZoneOffset = event['eventTimeZoneOffset']
        
        if 'businessLocationId' not in event:
            error('Missing business location for event ' + eventId + '!')

            
        locationIdValue = event['businessLocationId']
        
        if len(locationIdValue) < 3 or locationIdValue[0:3] != 'ot:': # OriginTrail Business Location Identificator
            locationIdValue = providerId + ':otblid:' + locationIdValue
        
        
        eventLocation = locationIdValue
        
        if eventLocation not in LOCATIONS:
            error('Business Location ' + eventLocation + ', ' + event['businessLocationId'] + ' for event ' + eventId + ' not provided in Locations section!')

            
        if 'businessProcess' not in event:
            error('Missing business process for event ' + eventId + '!')

            
        inputProductProvided = False
        
        if eventType == 'TransformationEvent':
        
            if 'inputProduct' in event:
                inputProductProvided = True
            
                inputProduct = event['inputProduct']
            
                if 'productId' not in inputProduct:
                    error('Missing product identificator for input product for event ' + eventId)

                    
                productIdValue = inputProduct['productId']
                
                if len(productIdValue) < 3 or productIdValue[0:3] != 'ot:': # OriginTrail Product Identificator
                    productIdValue = providerId + ':otpid:' + productIdValue
                    
                if productIdValue not in PRODUCTS:
                    error('Product ' + inputProduct['productId'] + ' not provided in Products section!')
        
                    
                    
                if 'productBatchId' in inputProduct:
                    
                    productBatchId = inputProduct['productBatchId']
                    
                    if len(productBatchIdValue) < 3 or productBatchIdValue[0:3] != 'ot:':
                        productBatchIdValue = productIdValue + ':otbid:' + productBatchIdValue
                        
                    if productBatchIdValue not in BATCHES:
                        error('Product batch ' + inputProduct['productBatchId'] + ' for product ' + inputProduct['productId'] + ' not provided in Products section!')
                
                        
                    inputBatchId = productBatchIdValue
                else:
                    inputBatchId = productIdValue + creationTimestamp + str(time.time())
                    BATCHES[inputBatchId] = {}
                    BATCHES[inputBatchId]['_key'] = hashed('product_batch_' + inputBatchId)
                    BATCHES[inputBatchId]['id'] = inputBatchId
                    BATCHES[inputBatchId]['nodekey'] = hashed('product_batch_' + inputBatchId)
                    BATCHES[inputBatchId]['type'] = 'dummy_batch'

                    INSTANCE_OF.append({'_from': BATCHES[inputBatchId]['nodekey'], '_to':PRODUCTS[productIdValue]['nodekey'], '_key': hashed('instance_of_' + BATCHES[inputBatchId]['nodekey'] + PRODUCTS[productIdValue]['nodekey'])})
                    
                inputProductId = productIdValue
                
                
            if 'outputProduct' not in event:
                error('Missing output product for event ' + eventId)
            
                
            outputProduct = event['outputProduct']
        
            if 'productId' not in outputProduct:
                error('Missing product identificator for output product for event ' + eventId)
        
                
            productIdValue = outputProduct['productId']
                
            if len(productIdValue) < 3 or productIdValue[0:3] != 'ot:': # OriginTrail Product Identificator
                productIdValue = providerId + ':otpid:' + productIdValue
                
            if productIdValue not in PRODUCTS:
                error('Product ' + outputProduct['productId'] + ' not provided in Products section!')

                
            if 'productBatchId' in outputProduct:
                
                productBatchIdValue = outputProduct['productBatchId']
                
                if len(productBatchIdValue) < 3 or productBatchIdValue[0:3] != 'ot:':
                    productBatchIdValue = productIdValue + ':otbid:' + productBatchIdValue
                    
                if productBatchIdValue not in BATCHES:
                    error('Product batch ' + outputProduct['productBatchId'] + ' for product ' + outputProduct['productId'] + ' not provided in Products section!')
            
                    
                outputBatchId = productBatchIdValue
            else:
                outputBatchId = productIdValue + ':otbid:' + creationTimestamp + str(time.time())
                BATCHES[outputBatchId] = {}
                BATCHES[outputBatchId]['_key'] = hashed('product_batch_' + outputBatchId)
                BATCHES[outputBatchId]['id'] = outputBatchId
                BATCHES[outputBatchId]['nodekey'] = hashed('product_batch_' + outputBatchId)
                BATCHES[outputBatchId]['type'] = 'dummy_batch'

                INSTANCE_OF.append({'_from': BATCHES[outputBatchId]['nodekey'], '_to':PRODUCTS[productIdValue]['nodekey'], '_key': hashed('instance_of_' + BATCHES[outputBatchId]['nodekey'] + PRODUCTS[productIdValue]['nodekey'])})
                
            outputProductId = productIdValue
        
            eventIdValue = providerId + ':event:' + eventId
        
            EVENTS[eventId] = {}
            EVENTS[eventId]['_key'] = hashed('event_' + eventIdValue)
            EVENTS[eventId]['nodekey'] = hashed('event_' + eventIdValue)
            EVENTS[eventId]['uid'] = eventIdValue
            EVENTS[eventId]['id'] = eventId
            EVENTS[eventId]['type'] = 'TransformationEvent'
            
            if inputProductProvided:
                EVENTS[eventId]['InputProduct'] = inputProductId
                SOURCE_BATCH.append({'_from': EVENTS[eventId]['nodekey'], '_to':BATCHES[inputBatchId]['nodekey'], '_key':hashed('SOURCE_BATCH_' + EVENTS[eventId]['nodekey'] + BATCHES[inputBatchId]['nodekey'])})
            
            EVENTS[eventId]['OutputProduct'] = outputProductId
            EVENTS[eventId]['BusinessLocation'] = event['businessLocationId']
            EVENTS[eventId]['BusinessProcess'] = event['businessProcess']
            EVENTS[eventId]['Provider'] = providerId
            EVENTS[eventId]['EventType'] = 'Transformation'
            
            if 'eventDocumentId' in event:
                EVENTS[eventId]['eventDocumentId'] = event['eventDocumentId']
            
            RESULTED_BATCH.append({'_to': EVENTS[eventId]['nodekey'], '_from':BATCHES[outputBatchId]['nodekey'], '_key':hashed('resulted_' + EVENTS[eventId]['nodekey'] + BATCHES[outputBatchId]['nodekey'])})
            AT.append({'_from': EVENTS[eventId]['nodekey'], '_to': LOCATIONS[eventLocation]['nodekey'], '_key':hashed('at_' + EVENTS[eventId]['nodekey'] + LOCATIONS[eventLocation]['nodekey'])})
        
        elif eventType == 'TransferEvent':
            if 'Product' not in event:
                error('Missing Product for TransferEvent ' + eventId + '!')

                
            transferProduct = event['Product']
            
            if 'productId' not in transferProduct:
                    error('Missing product identificator for input product for event ' + eventId)
                    
                    
            productIdValue = transferProduct['productId']
            
            if len(productIdValue) < 3 or productIdValue[0:3] != 'ot:': # OriginTrail Product Identificator
                productIdValue = providerId + ':otpid:' + productIdValue
                
            if productIdValue not in PRODUCTS:
                error('Product ' + transferProduct['productId'] + ' not provided in Products section!')
        
                
                
            if 'productBatchId' in transferProduct:
                
                productBatchIdValue = transferProduct['productBatchId']
                
                if len(productBatchIdValue) < 3 or productBatchIdValue[0:3] != 'ot:':
                    productBatchIdValue = productIdValue + ':otbid:' + productBatchIdValue
                    
                if productBatchIdValue not in BATCHES: 
                    error('Product batch ' + transferProduct['productBatchId']+ ' for product ' + transferProduct['productId'] + ' not provided in Products section!')
                    
                    
                transferBatchId = productBatchIdValue
            else:
                transferBatchId = productIdValue + creationTimestamp + str(time.time())
                BATCHES[transferBatchId] = {}
                BATCHES[transferBatchId]['_key'] = hashed('product_batch_' + transferBatchId)
                BATCHES[transferBatchId]['nodekey'] = hashed('product_batch_' + transferBatchId)
                BATCHES[transferBatchId]['type'] = 'dummy_batch'

                INSTANCE_OF.append({'_from':BATCHES[transferBatchId]['nodekey'], '_to':PRODUCTS[productIdValue]['nodekey'], '_key':hashed('instance_of_' + BATCHES[transferBatchId]['nodekey'] + PRODUCTS[productIdValue]['nodekey'])})
                
            transferProductId = productIdValue
            
            if 'sourceBusinessLocationId' not in event:
                error('Missing Source Business Location for Transfer Event ' + eventId)
        
                
            locationIdValue = event['sourceBusinessLocationId']
    
            
            if len(location) < 3 or locationIdValue[0:3] != 'ot:': # OriginTrail Business Location Identificator
                locationIdValue = providerId + ':otblid:' + locationIdValue
            
            sourceLocation = locationIdValue
            
            if sourceLocation not in LOCATIONS:
                error('Source Business Location ' + event['sourceBusinessLocationId'] + ' for Transfer event ' + eventId + ' not provided in Locations section!')
        
            
            if 'destBusinessLocationId' not in event:
                error('Missing Destination Business Location for Transfer Event ' + eventId)

                
            locationIdValue = event['destBusinessLocationId']
            
            
            if len(location) < 3 or locationIdValue[0:3] != 'ot:': # OriginTrail Business Location Identificator
                locationIdValue = providerId + ':otblid:' + locationIdValue
            
            destLocation = locationIdValue
            
            if destLocation not in LOCATIONS:
                error('Destination Business Location ' + event['destBusinessLocationId']+ ' for Transfer event ' + eventId + ' not provided in Locations section!')
            
            eventIdValue = providerId + ':event:' + eventId
            
            EVENTS[eventId] = {}
            EVENTS[eventId]['_key'] = hashed('event_' + eventIdValue)
            EVENTS[eventId]['nodekey'] = hashed('event_' + eventIdValue)
            EVENTS[eventId]['uid'] = eventIdValue
            EVENTS[eventId]['id'] = eventId
            EVENTS[eventId]['type'] = 'TransferEvent'

            EVENTS[eventId]['SourceBusinessLocation'] = LOCATIONS[sourceLocation]['nodekey']
            EVENTS[eventId]['DestinationBusinessLocation'] = LOCATIONS[destLocation]['nodekey']
            
            EVENTS[eventId]['TransferedProduct'] = transferProductId
            EVENTS[eventId]['BusinessLocation'] = event['businessLocationId']
            EVENTS[eventId]['BusinessProcess'] = event['businessProcess']
            EVENTS[eventId]['Provider'] = providerId
            EVENTS[eventId]['EventType'] = 'Transfer'
            TRANSFER_EVENTS.append({'id': eventId, '_key': hashed('event_' + eventIdValue)})
            
            if 'eventDocumentId' in event:
                EVENTS[eventId]['eventDocumentId'] = event['eventDocumentId']

            
            OF_BATCH.append({'_to': EVENTS[eventId]['nodekey'], '_from':BATCHES[transferBatchId]['nodekey'], '_key':hashed('of_batch_' + EVENTS[eventId]['nodekey'] + BATCHES[transferBatchId]['nodekey'])})
            AT.append({'_from': EVENTS[eventId]['nodekey'], '_to': LOCATIONS[eventLocation]['nodekey'], '_key':hashed('at_' + EVENTS[eventId]['nodekey'] + LOCATIONS[eventLocation]['nodekey'])})
            FROM.append({'_from': EVENTS[eventId]['nodekey'], '_to':LOCATIONS[sourceLocation]['nodekey'], '_key':hashed('sent_from_' + EVENTS[eventId]['nodekey'] + LOCATIONS[sourceLocation]['nodekey'])})
            TO.append({'_from': EVENTS[eventId]['nodekey'], '_to':LOCATIONS[destLocation]['nodekey'], '_key':hashed('sent_to_' + EVENTS[eventId]['nodekey'] + LOCATIONS[destLocation]['nodekey'])})
            
        else:
            error('Invalid event type ' + eventType +'!')

# Importing parsed data into graph database

for key, provider in PROVIDERS.items():
    insert_node('PROVIDER', provider)
    
for key, location in LOCATIONS.items():
    insert_node('BUSINESS_LOCATION', location)
    
for key, product in PRODUCTS.items():
    insert_node('PRODUCT', product)
    
for key, batch in BATCHES.items():
    insert_node('PRODUCT_BATCH', batch)
    
for key, event in EVENTS.items():
    insert_node('EVENT', event)



for owns_relation in OWNED_BY:
    insert_edge('OWNED_BY', owns_relation)
    
for at_relation in AT:
    insert_edge('AT', at_relation)
    
for SOURCE_BATCH_relation in SOURCE_BATCH:
    insert_edge('SOURCE_BATCH', SOURCE_BATCH_relation)
    
for resulted_relation in RESULTED_BATCH:
    insert_edge('RESULTED_BATCH', resulted_relation)

for instance_of_relation in INSTANCE_OF:
    insert_edge('INSTANCE_OF', instance_of_relation)

for of_batch_relation in OF_BATCH:
    insert_edge('OF_BATCH', of_batch_relation )
    
for sent_from_relation in FROM:
    insert_edge('FROM', sent_from_relation)
    
for sent_to_relation in TO:
    insert_edge('TO', sent_to_relation)
    
print(dumps({"message": "Data import complete!", "batches": BATCHES, "transferEvents": TRANSFER_EVENTS}))
sys.stdout.flush()