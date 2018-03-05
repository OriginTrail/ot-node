import sys
sys.path.append('./dependencies')
from xmljson import yahoo as parser
from xml.etree.ElementTree import fromstring
from xml.etree.ElementTree import ParseError
from json import dumps, loads
import hashlib
import time
import os

from os.path import join, dirname
from dotenv import load_dotenv

dotenv_path = join(dirname(__file__), '..','.env')
load_dotenv(dotenv_path)

from arango import ArangoClient

if len(sys.argv) != 2:
    print("Invalid number of arguments, required format: python xmlimporter.py import_file.xml")
    sys.exit()

# Entities
PARTICIPANTS = {}
LOCATIONS = {}
OBJECTS = {}
BATCHES = {}
TRANSACTIONS = {}
EVENTS = {}

INPUT_BATCHES = []
OUTPUT_BATCHES = []
TRANSFERED_BATCHES = []

# Relations
OWNED_BY = []
AT = []
INPUT_BATCH = []
OUTPUT_BATCH = []
INSTANCE_OF = [] 
OF_BATCH = [] 
TRACED_BY = [] 
FROM = []
TO = []

#Database connection

client = ArangoClient(protocol = 'http',
host = "localhost",
port = "8529",
username = "root",
password = "root",
enable_logging = True)

db = client.db('origintrail')
# client.grant_user_access(os.environ.get("DB_USERNAME"), os.environ.get("DB_DATABASE"))

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
   hash_method.update(source_string.encode('utf-8'))
   return hash_method.hexdigest()

# Error display function

def error(error_message):
    sys.stderr.write("ERROR: " + error_message)
    sys.exit()

# Insert new node_value

def insert_node(collection, node_value, data_provider):
    node_value['vertex_type'] = collection
    node_value['data_provider'] = data_provider
    nodesCollection = db.collection('ot_vertices')

    if nodesCollection.has(node_value['_key']):
        return
    else:
        nodesCollection.insert(dumps(node_value))

# Insert new edge

def insert_edge(collection, edge_value, data_provider):
    edge_value['_to'] = 'ot_vertices/' + edge_value['_to']
    edge_value['_from'] = 'ot_vertices/' + edge_value['_from']
    edge_value['data_provider'] = data_provider
    edge_value['edge_type'] = collection
    edgesCollection = db.collection('ot_edges')
    
    if edgesCollection.get(edge_value['_key']):
        return
    else:
        edgesCollection.insert(dumps(edge_value))
  
def joinTransactions(transaction, data_provider_id):
    transaction_id = transaction['identifiers']['ExternalTransactionId']
    key = transaction['_key']

    if transaction['data']['TransactionFlow'] == 'Input':
        aql = "FOR e IN ot_vertices FILTER e.vertex_type == 'TRANSACTION' and e.transaction_flow == 'Output' and e.identifiers.TransactionId == '" + transaction_id + "' and e._key != '"+ key +"' RETURN e._key"
    
        result = db.aql.execute(aql);
    
        for res_key in result:
            insert_edge('TRANSACTION_CONNECTION', {'_key':hashed(key + "-" + res_key), 'TransactionFlow': 'Output', '_from': key, '_to' : res_key}, data_provider_id)
            insert_edge('TRANSACTION_CONNECTION', {'_key':hashed(res_key + "-" + key), 'TransactionFlow': 'Input', '_from': res_key, '_to' : key}, data_provider_id)
    else:    
        aql = "FOR e IN ot_vertices FILTER e.vertex_type == 'TRANSACTION' and e.transaction_flow == 'Input' and e.identifiers.TransactionId == '" + transaction_id + "' and e._key != '"+ key +"' RETURN e._key"
    
        result = db.aql.execute(aql);
    
        for res_key in result:
            insert_edge('TRANSACTION_CONNECTION', {'_key':hashed(key + "-" + res_key), 'TransactionFlow': 'Input', '_from': key, '_to' : res_key}, data_provider_id)
            insert_edge('TRANSACTION_CONNECTION', {'_key':hashed(res_key + "-" + key), 'TransactionFlow': 'Output', '_from': res_key, '_to' : key}, data_provider_id)
# Collaboration check

def isCollaborationConfirmed(providerId, partnerId):
    return True

# Find vertex key by id and vertex type

def hasVertex(vertex_key):
    nodesCollection = db.collection('ot_vertices')
    return nodesCollection.has(vertex_key);

# Loading XML from input file supplied in command line argument
xml_file_url = sys.argv[1]
xml_file = open(xml_file_url, "r") 
xml_data = xml_file.read() 

# Data from import file loaded as dictionary

try:
    import_data = parser.data(fromstring(xml_data))
except ParseError:
    error('Invalid XML file')
    
if 'OriginTrailExport' not in import_data:
    error("Missing OriginTrailExport element!")


# Reading file header

OriginTrailExport_element = import_data['OriginTrailExport']

if 'version' not in OriginTrailExport_element:
    error('Missing version number attribute for OriginTrailExport element!')

export_version = OriginTrailExport_element['version']

if 'DataProvider' not in OriginTrailExport_element:
    error("Missing DataProvider element!")
    
DataProvider_element = OriginTrailExport_element['DataProvider']

if isinstance(DataProvider_element, list):
    error("Multiple DataProvider elements!")
    
if 'ParticipantId' not in DataProvider_element:
    error('Missing ParticipantId element for DataProvider!')
    
data_provider_id = DataProvider_element['ParticipantId']


# Reading Master Data

if 'MasterData' in OriginTrailExport_element:
   
    MasterData_element = OriginTrailExport_element['MasterData']
   
   
    # Reading Participants Data
   
    if 'ParticipantsList' in MasterData_element:
        
        ParticipantsList_element = MasterData_element['ParticipantsList']
        
        if 'Participant' not in ParticipantsList_element:
            error('Missing Participant element for ParticipantsList')
        
        Participant_elements = ParticipantsList_element['Participant']
        
        if not isinstance(Participant_elements, list):
            tmp_Participant_elements = Participant_elements
            Participant_elements = []
            Participant_elements.append(tmp_Participant_elements)
            
        for participant_element in Participant_elements:
            
            if 'ParticipantIdentifiers' not in participant_element:
                error('Missing ParticipantIdentifiers element for Participant!')
                
            ParticipantIdentifiers_element = participant_element['ParticipantIdentifiers']
                
            if 'ParticipantId' not in ParticipantIdentifiers_element:
                error('Missing ParticipantId for Participant!')
                
            participant_id = ParticipantIdentifiers_element['ParticipantId']

            participant_uid = 'ot:' + data_provider_id + ':otpartid:' + participant_id
            
            if 'ParticipantData' not in participant_element:
                error('Missing ParticipantData element for Participant!')
            
            ParticipantData_element = participant_element['ParticipantData']
            
            PARTICIPANTS[participant_id] = {}
            PARTICIPANTS[participant_id]['identifiers'] = ParticipantIdentifiers_element
            PARTICIPANTS[participant_id]['identifiers']['uid'] = participant_uid
            PARTICIPANTS[participant_id]['data'] = ParticipantData_element
            PARTICIPANTS[participant_id]['_key'] = hashed('participant_' + participant_uid)
            PARTICIPANTS[participant_id]['vertex_key'] = hashed('participant_' + participant_uid)

    
    # Reading Business Locations Data
   
    if 'BusinessLocationsList' in MasterData_element:
        
        BusinessLocationsList_element = MasterData_element['BusinessLocationsList']
        
        if 'BusinessLocation' not in BusinessLocationsList_element:
            error('Missing BusinessLocation element for BusinessLocationsList!')
            
        BusinessLocation_elements = BusinessLocationsList_element['BusinessLocation']
        
        if not isinstance(BusinessLocation_elements, list):
            tmp_BusinessLocation_elements = BusinessLocation_elements
            BusinessLocation_elements = []
            BusinessLocation_elements.append(tmp_BusinessLocation_elements)

        for business_location_element in BusinessLocation_elements:
            
            if 'BusinessLocationOwnerId' not in business_location_element:
                error('Missing BusinessLocationOwnerId for BusinessLocation!');
            
            business_location_owner_id = business_location_element['BusinessLocationOwnerId']
            
            if business_location_owner_id in PARTICIPANTS:
                business_location_owner_key = PARTICIPANTS[business_location_owner_id]['_key']
            else:
                business_location_owner_key = hashed('participant_ot:' + data_provider_id + ':otpartid:' + business_location_owner_id)
            
                if not hasVertex(business_location_owner_key):
                    error('Business location owner with id ' + business_location_owner_id + ' is not provided in export nor found in database!')
           
            if not business_location_owner_key:
                error('Business location owner with id ' + business_location_owner_id + ' not provided in export nor found in database')
            
            if 'BusinessLocationIdentifiers' not in business_location_element:
                error('Missing BusinessLocationIdentifiers element for BusinessLocation!')
                
            BusinessLocationIdentifiers_element = business_location_element['BusinessLocationIdentifiers']
            
            if 'BusinessLocationId' not in BusinessLocationIdentifiers_element:
                error('Missing BusinessLocationId for BusinessLocation')
                
            business_location_id = BusinessLocationIdentifiers_element['BusinessLocationId']
            
            business_location_uid = 'ot:' + data_provider_id + ':otblid:' + business_location_id
        
            if 'BusinessLocationData' not in business_location_element:
                error('Missing BusinessLocationData element for BusinessLocation!')
                
            BusinessLocationData_element = business_location_element['BusinessLocationData']
            
            LOCATIONS[business_location_id] = {}
            LOCATIONS[business_location_id]['identifiers'] = BusinessLocationIdentifiers_element
            LOCATIONS[business_location_id]['identifiers']['uid'] = business_location_uid
            LOCATIONS[business_location_id]['data'] = BusinessLocationData_element
            LOCATIONS[business_location_id]['_key'] = hashed('business_location_' + business_location_uid)
            LOCATIONS[business_location_id]['vertex_key'] = hashed('business_location_' + business_location_uid)
            
            OWNED_BY.append({
                    '_from': LOCATIONS[business_location_id]['_key'],
                    '_to': business_location_owner_key,
                    '_key': hashed('owned_by_' + business_location_owner_key + '_' + LOCATIONS[business_location_id]['_key'])
                })
            
    # Reading Objects Data
   
    if 'ObjectsList' in MasterData_element:
        
        ObjectsList_element = MasterData_element['ObjectsList']
        
        if 'Object' not in ObjectsList_element:
            error('Missing Object element for ObjectsList!')
                
        Object_elements = ObjectsList_element['Object']
        
        if not isinstance(Object_elements, list):
            tmp_Object_elements = Object_elements
            Object_elements = []
            Object_elements.append(tmp_Object_elements)
        
        for object_element in Object_elements:
            
            if 'ObjectIdentifiers' not in object_element :
                error('Missing ObjectIdentifiers element for Object!')
                
            ObjectIdentifiers_element = object_element['ObjectIdentifiers']
            
            if 'ObjectId' not in ObjectIdentifiers_element:
                error('Missing ObjectId for Object')
                
            object_id = ObjectIdentifiers_element['ObjectId']
            
            object_uid = 'ot:' + data_provider_id + ':otoid:' + object_id
        
            if 'ObjectData' not in object_element:
                error('Missing ObjectData element for Object!')
                
            ObjectData_element = object_element['ObjectData']
            
            OBJECTS[object_id] = {}
            OBJECTS[object_id]['identifiers'] = ObjectIdentifiers_element
            OBJECTS[object_id]['identifiers']['uid'] = object_uid
            OBJECTS[object_id]['data'] = ObjectData_element
            OBJECTS[object_id]['_key'] = hashed('object_' + object_uid)
            OBJECTS[object_id]['vertex_key'] = hashed('object_' + object_uid)

             # Reading Objects Data
   
    if 'BatchesList' in MasterData_element:
        
        BatchesList_element = MasterData_element['BatchesList']
        
        if 'Batch' not in BatchesList_element:
            error('Missing Batch element for BatchesList!')
                
        Batch_elements = BatchesList_element['Batch']
        
        if not isinstance(Batch_elements, list):
            tmp_Batch_elements = Batch_elements
            Batch_elements = []
            Batch_elements.append(tmp_Batch_elements)
        
        for batch_element in Batch_elements:
            
            if 'BatchIdentifiers' not in batch_element:
                error('Missing BatchIdentifiers element for Batch!')
                
            BatchIdentifiers_element = batch_element['BatchIdentifiers']
            
            if 'BatchId' not in BatchIdentifiers_element:
                error('Missing BatchId for Batch')

            batch_id = BatchIdentifiers_element['BatchId']

            if 'ObjectId' not in ObjectIdentifiers_element:
                error('Missing ObjectId for Batch')
            
            object_id = BatchIdentifiers_element['ObjectId']

            if object_id in OBJECTS:
                object_key = OBJECTS[object_id]['_key']
            else:
                object_key = hashed('object_ot:' + data_provider_id + ':otoid:' + object_id)
            
                if not hasVertex(object_key):
                    error('Object with id ' + object_id + ' is not provided in export nor found in database!')
            
            batch_uid = 'ot:' + data_provider_id + ':otbid:' + batch_id
        
            if 'BatchData' not in batch_element:
                error('Missing BatchData element for Object!')
                
            BatchData_element = batch_element['BatchData']
            
            BATCHES[batch_uid] = {}
            BATCHES[batch_uid]['identifiers'] = BatchIdentifiers_element
            BATCHES[batch_uid]['identifiers']['uid'] = batch_uid
            BATCHES[batch_uid]['data'] = BatchData_element
            BATCHES[batch_uid]['_key'] = hashed('batch_' + batch_uid)
            BATCHES[batch_uid]['vertex_key'] = hashed('batch_' + batch_uid)
            
            INSTANCE_OF.append({
                    '_from': BATCHES[batch_uid]['vertex_key'],
                    '_to': object_key,
                    '_key': hashed('instance_of_' + BATCHES[batch_uid]['vertex_key'] + '_' + object_key)
                })
    
            

# Reading Transactions Data

if 'TransactionData' in OriginTrailExport_element:
    
    TransactionsData_element = OriginTrailExport_element['TransactionData']
    
    # Reading internal transactions data

    if 'InternalTransactionsList' in TransactionsData_element:
        
        InternalTransactionsList_element = TransactionsData_element['InternalTransactionsList']
        
        if 'InternalTransaction' not in InternalTransactionsList_element:
            error('Missing InternalTransaction element for InternalTransactionsList!')
                
        InternalTransaction_elements = InternalTransactionsList_element['InternalTransaction']
        
        if not isinstance(InternalTransaction_elements, list):
            tmp_InternalTransaction_elements = InternalTransaction_elements 
            InternalTransaction_elements  = []
            InternalTransaction_elements.append(tmp_InternalTransaction_elements)
        
        for internal_transaction_element in InternalTransaction_elements:
            
            if 'InternalTransactionIdentifiers' not in internal_transaction_element :
                error('Missing InternalTransactionIdentifiers element for InternalTransaction!')
                
            InternalTransactionIdentifiers_element = internal_transaction_element['InternalTransactionIdentifiers']
            
            if 'InternalTransactionId' not in InternalTransactionIdentifiers_element:
                error('Missing InternalTransactionId for InternalTransaction!')
                
            internal_transaction_id = InternalTransactionIdentifiers_element['InternalTransactionId']
            
            internal_transaction_uid = 'ot:' + data_provider_id + ':ottid:' + internal_transaction_id
            
            if 'TransactionBatchesInformation' not in internal_transaction_element:
                error('Missing TransactionBatchesInformation element for InternalTransaction!')
                
            BatchesInformation_element = internal_transaction_element['TransactionBatchesInformation']
           
           # Reading input batches for internal transaction
           
            if 'InputBatchesList' in BatchesInformation_element:

                InputBatchesList_element = BatchesInformation_element['InputBatchesList']
            
                if 'TransactionBatch' not in InputBatchesList_element:
                    error('Missing TransactionBatch element for InputBatchesList!')
                        
                Batch_elements = InputBatchesList_element['TransactionBatch']
                
                if not isinstance(Batch_elements, list):
                    tmp_Batch_elements = Batch_elements
                    Batch_elements = []
                    Batch_elements.append(tmp_Batch_elements)
                
                INPUT_BATCHES = []

                for batch_element in Batch_elements:

                    if 'TransactionBatchId' not in batch_element:
                        error('Missing TransactionBatchId for Batch!')
                        
                    batch_id = batch_element['TransactionBatchId']
                    
                    batch_uid = 'ot:' + data_provider_id + ':otbid:' + batch_id

                    if batch_uid in BATCHES:
                        batch_key = BATCHES[batch_uid]['_key']
                    else:
                        batch_key = hashed('batch_' + batch_uid)
                    
                        if not hasVertex(object_key):
                            error('Batch with id ' + batch_id + ' is not provided in export nor found in database!')
                    
                    if 'TransactionBatchData' not in batch_element:
                        error('Missing TransactionBatchData element for Batch!')
                        
                    INPUT_BATCHES.append(batch_key);
            
            # Reading output units for internal transaction
            
            if 'OutputBatchesList' not in BatchesInformation_element:
                error('Missing OutputBatchesList for TransactionBatchesInformation')

            OutputBatchesList_element = BatchesInformation_element['OutputBatchesList']
        
            if 'TransactionBatch' not in OutputBatchesList_element:
                error('Missing TransactionBatch element for OutputBatchesList!')
                    
            Batch_elements = OutputBatchesList_element['TransactionBatch']
            
            if not isinstance(Batch_elements, list):
                tmp_Batch_elements = Batch_elements
                Batch_elements = []
                Batch_elements.append(tmp_Batch_elements)
            
            OUTPUT_BATCHES = []
            
            for batch_element in Batch_elements:
                
                if 'TransactionBatchId' not in batch_element:
                    error('Missing BatchId for Batch!')
                    
                batch_id = batch_element['TransactionBatchId']
                
                batch_uid = 'ot:' + data_provider_id + ':otbid:' + batch_id

                if batch_uid in BATCHES:
                    batch_key = BATCHES[batch_uid]['_key']
                else:
                    batch_key = hashed('batch_' + batch_uid)
                
                    if not hasVertex(object_key):
                        error('Batch with id ' + batch_id + ' is not provided in export nor found in database!')
                
                if 'TransactionBatchData' not in batch_element:
                    error('Missing TransactionBatchData element for Batch!')
                    
                BatchData_element = batch_element['TransactionBatchData']
                
                OUTPUT_BATCHES.append(batch_key);
        
            if 'InternalTransactionData' not in internal_transaction_element:
                error('Missing InternalTransactionData element for InternalTransaction!')
                
            InternalTransactionData_element = internal_transaction_element['InternalTransactionData']
            
            if 'BusinessLocationId' not in InternalTransactionData_element:
                error('Missing BusinessLocationId for Internal Transaction!')
        
            business_location_id = InternalTransactionData_element['BusinessLocationId']
            
            if business_location_id in LOCATIONS:
                    business_location_key = LOCATIONS[business_location_id]['_key']
            else:
                business_location_key = hashed('business_location_ot:' + data_provider_id + ':otblid:' + business_location_id)
            
                if not hasVertex(business_location_key):
                    error('Business location with id ' + business_location_id + ' is not provided in export nor found in database!')
                
            
            TRANSACTIONS[internal_transaction_id] = {}
            TRANSACTIONS[internal_transaction_id]['identifiers'] = InternalTransactionIdentifiers_element
            TRANSACTIONS[internal_transaction_id]['identifiers']['uid'] = internal_transaction_uid
            TRANSACTIONS[internal_transaction_id]['identifiers']['TransactionId'] = internal_transaction_id
            TRANSACTIONS[internal_transaction_id]['data'] = InternalTransactionData_element
            TRANSACTIONS[internal_transaction_id]['data']['BatchesInformation'] = BatchesInformation_element
            TRANSACTIONS[internal_transaction_id]['TransactionType'] = 'InternalTransaction'
            TRANSACTIONS[internal_transaction_id]['_key'] = hashed('transaction_' + internal_transaction_uid)
            TRANSACTIONS[internal_transaction_id]['vertex_key'] = hashed('transaction_' + internal_transaction_uid)

            AT.append({
                    '_from': TRANSACTIONS[internal_transaction_id]['_key'],
                    '_to': business_location_key,
                    '_key': hashed('at_' + TRANSACTIONS[internal_transaction_id]['_key'] + '_' + business_location_key)
                })

            for input_batch in INPUT_BATCHES:
                INPUT_BATCH.append({
                        '_from': TRANSACTIONS[internal_transaction_id]['_key'],
                        '_to': input_batch,
                        '_key': hashed('input_batch_' + TRANSACTIONS[internal_transaction_id]['_key'] + '_' + input_batch)
                    })

            for output_batch in OUTPUT_BATCHES:
                OUTPUT_BATCH.append({
                        '_from': output_batch,
                        '_to': TRANSACTIONS[internal_transaction_id]['_key'],
                        '_key': hashed('output_batch_' + TRANSACTIONS[internal_transaction_id]['_key'] + '_' + output_batch)
                    })

    # Reading external transactions data

    if 'ExternalTransactionsList' in TransactionsData_element:
        
        ExternalTransactionsList_element = TransactionsData_element['ExternalTransactionsList']
        
        if 'ExternalTransaction' not in ExternalTransactionsList_element:
            error('Missing ExternalTransaction element for ExternalTransactionsList!')

        ExternalTransaction_elements = ExternalTransactionsList_element['ExternalTransaction']
        
        if not isinstance(ExternalTransaction_elements, list):
            tmp_ExternalTransaction_elements = ExternalTransaction_elements 
            ExternalTransaction_elements  = []
            ExternalTransaction_elements.append(tmp_ExternalTransaction_elements)
        
        for external_transaction_element in ExternalTransaction_elements:
            
            if 'ExternalTransactionIdentifiers' not in external_transaction_element :
                error('Missing ExternalTransactionIdentifiers element for ExternalTransaction!')
                
            ExternalTransactionIdentifiers_element = external_transaction_element['ExternalTransactionIdentifiers']
            
            if 'ExternalTransactionId' not in ExternalTransactionIdentifiers_element:
                error('Missing ExternalTransactionId for ExternalTransaction!')
                
            external_transaction_id = ExternalTransactionIdentifiers_element['ExternalTransactionId']
            
            external_transaction_uid = 'ot:' + data_provider_id + ':ottid:' + external_transaction_id
            
            if 'TransactionBatchesInformation' not in external_transaction_element:
                error('Missing TransactionBatchesInformation element for ExternalTransaction!')
                
            BatchesInformation_element = external_transaction_element['TransactionBatchesInformation']
           
           # Reading batches for external transaction

            if 'TransactionBatchesList' not in BatchesInformation_element:
                    error('Missing TransactionBatchesList for ExternalTransaction!')

            BatchesList_element = BatchesInformation_element['TransactionBatchesList']
        
            if 'TransactionBatch' not in BatchesList_element:
                error('Missing TransactionBatch element for TransactionBatchesList!')
                    
            Batch_elements = BatchesList_element['TransactionBatch']
            
            if not isinstance(Batch_elements, list):
                tmp_Batch_elements = Batch_elements
                Batch_elements = []
                Batch_elements.append(tmp_Batch_elements)
            
            TRANSFERED_BATCHES = []
            
            for batch_element in Batch_elements:
                    
                if 'TransactionBatchId' not in batch_element:
                    error('Missing BatchId for Batch!')
                    
                batch_id = batch_element['TransactionBatchId']
                
                batch_uid = 'ot:' + data_provider_id + ':otbid:' + batch_id

                if batch_uid in BATCHES:
                    batch_key = BATCHES[batch_uid]['_key']
                else:
                    batch_key = hashed('batch_' + batch_uid)
                
                    if not hasVertex(object_key):
                        error('Batch with id ' + batch_id + ' is not provided in export nor found in database!')
                
                if 'TransactionBatchData' not in batch_element:
                    error('Missing TransactionBatchData element for Batch!')
            
                TRANSFERED_BATCHES.append(batch_key);

                if 'ExternalTransactionData' not in external_transaction_element:
                    error('Missing ExternalTransactionData element for ExternalTransaction!')
                
                ExternalTransactionData_element = external_transaction_element['ExternalTransactionData']
                
                if 'BusinessLocationId' not in ExternalTransactionData_element:
                    error('Missing BusinessLocationId for External Transaction!')
            
                business_location_id = ExternalTransactionData_element['BusinessLocationId']
                
                if business_location_id in LOCATIONS:
                        business_location_key = LOCATIONS[business_location_id]['_key']
                else:
                    business_location_key = hashed('object_ot:' + data_provider_id + ':otoid:' + business_location_id)
                
                    if not hasVertex(business_location_key):
                        error('Business location with id ' + business_location_id + ' is not provided in export nor found in database!')

                if 'BusinessLocationId' not in ExternalTransactionData_element:
                    error('Missing BusinessLocationId for External Transaction!')
                
                source_business_location_id = ExternalTransactionData_element['SourceBusinessLocationId']
                
                if source_business_location_id in LOCATIONS:
                        source_business_location_key = LOCATIONS[source_business_location_id]['_key']
                else:
                    source_business_location_key = hashed('object_ot:' + data_provider_id + ':otoid:' + source_business_location_id)
                
                    if not hasVertex(source_business_location_key):
                        error('Business location with id ' + source_business_location_id + ' is not provided in export nor found in database!')
                
                dest_business_location_id = ExternalTransactionData_element['DestinationBusinessLocationId']
                
                if dest_business_location_id in LOCATIONS:
                        dest_business_location_key = LOCATIONS[dest_business_location_id]['_key']
                else:
                    dest_business_location_key = hashed('object_ot:' + data_provider_id + ':otoid:' + dest_business_location_id)
                
                    if not hasVertex(dest_business_location_key):
                        error('Business location with id ' + dest_business_location_id + ' is not provided in export nor found in database!')    

                if 'TransactionFlow' not in ExternalTransactionData_element:
                    error('Missing TransactionFlow element for ExternalTransaction!')

                transaction_flow = ExternalTransactionData_element['TransactionFlow']

                if not (transaction_flow == 'Input' or transaction_flow == 'Output'):
                    error('Invalid value for TransactionFlow element!')

                TRANSACTIONS[external_transaction_id] = {}
                TRANSACTIONS[external_transaction_id]['identifiers'] = ExternalTransactionIdentifiers_element
                TRANSACTIONS[external_transaction_id]['identifiers']['uid'] = external_transaction_uid
                TRANSACTIONS[external_transaction_id]['identifiers']['TransactionId'] = external_transaction_id
                TRANSACTIONS[external_transaction_id]['transaction_flow'] = transaction_flow
                TRANSACTIONS[external_transaction_id]['data'] = ExternalTransactionData_element
                TRANSACTIONS[external_transaction_id]['data']['BatchesInformation'] = BatchesInformation_element
                TRANSACTIONS[external_transaction_id]['TransactionType'] = 'ExternalTransaction'
                TRANSACTIONS[external_transaction_id]['_key'] = hashed('transaction_' + external_transaction_uid)
                TRANSACTIONS[external_transaction_id]['vertex_key'] = hashed('transaction_' + external_transaction_uid)

                
                AT.append({
                    '_from': TRANSACTIONS[external_transaction_id]['_key'],
                    '_to': business_location_key,
                    '_key': hashed('at_' + TRANSACTIONS[external_transaction_id]['_key'] + '_' + business_location_key)
                })

                FROM.append({
                    '_from': TRANSACTIONS[external_transaction_id]['_key'],
                    '_to': source_business_location_key,
                    '_key': hashed('from_' + TRANSACTIONS[external_transaction_id]['_key'] + '_' + source_business_location_key)
                })

                TO.append({
                    '_from': TRANSACTIONS[external_transaction_id]['_key'],
                    '_to': dest_business_location_key,
                    '_key': hashed('to_' + TRANSACTIONS[external_transaction_id]['_key'] + '_' + dest_business_location_key)
                })

            for transfered_batch in TRANSFERED_BATCHES:
                OF_BATCH.append({
                        '_from': transfered_batch,
                        '_to': TRANSACTIONS[external_transaction_id]['_key'],
                        '_key': hashed('of_batch_' + TRANSACTIONS[external_transaction_id]['_key'] + '_' + transfered_batch)
                    })

                OF_BATCH.append({
                        '_from': TRANSACTIONS[external_transaction_id]['_key'],
                        '_to': transfered_batch,
                        '_key': hashed('of_batch_' + transfered_batch + '_' + TRANSACTIONS[external_transaction_id]['_key'])
                    })

# Reading Visibility Events data Data

if 'VisibilityEventData' in OriginTrailExport_element:
   
    VisibilityEventData_element = OriginTrailExport_element['VisibilityEventData']
   
   
   
    if 'VisibilityEventsList' in VisibilityEventData_element:
        
        VisibilityEventsList_element = VisibilityEventData_element['VisibilityEventsList']
        
        if 'Event' not in VisibilityEventsList_element:
            error('Missing Event element for VisibilityEventsList')
        
        Event_elements = VisibilityEventsList_element['Event']
        
        if not isinstance(Event_elements, list):
            tmp_Event_elements = Event_elements
            Event_elements = []
            Event_elements.append(tmp_Event_elements)
            
        for event_element in Event_elements:
            
            if 'EventIdentifiers' not in event_element:
                error('Missing EventIdentifiers element for Event!')
                
            EventIdentifiers_element = event_element['EventIdentifiers']
                
            if 'EventId' not in EventIdentifiers_element:
                error('Missing EventId for Event!')
                
            event_id = EventIdentifiers_element['EventId']

            event_uid = 'ot:' + data_provider_id + ':oteid:' + event_id

            if 'BatchId' not in EventIdentifiers_element:
                error('Missing BatchId for Event!')

            batch_id = EventIdentifiers_element['BatchId']
            batch_uid = 'ot:' + data_provider_id + ':otbid:' + batch_id

            if batch_uid in BATCHES:
                batch_key = BATCHES[batch_uid]['_key']
            else:

                batch_key = hashed('batch_' + batch_uid)

                if not hasVertex(batch_key):
                    error('Batch with id ' + batch_id + ' is not provided in export nor found in database!')
            
            if 'EventData' not in event_element:
                error('Missing EventData element for Event!')
            
            EventData_element = event_element['EventData']

            EVENTS[event_id] = {}
            EVENTS[event_id]['identifiers'] = EventIdentifiers_element
            EVENTS[event_id]['identifiers']['uid'] = event_uid
            EVENTS[event_id]['data'] = EventData_element
            EVENTS[event_id]['_key'] = hashed('event_' + event_uid)
            EVENTS[event_id]['vertex_key'] = hashed('event_' + event_uid)

            TRACED_BY.append({
                    '_from': batch_key,
                    '_to': EVENTS[event_id]['vertex_key'],
                    '_key': hashed('traced_by_' + batch_key + '_' + EVENTS[event_id]['vertex_key'])
                })


# Importing parsed data into graph database

for key, participant_vertex in PARTICIPANTS.items():
    insert_node('PARTICIPANT', participant_vertex, data_provider_id)
    
for key, location_vertex in LOCATIONS.items():
    insert_node('BUSINESS_LOCATION', location_vertex, data_provider_id)
    
for key, object_vertex in OBJECTS.items():
    insert_node('OBJECT', object_vertex, data_provider_id)
    
for key, batch_vertex in BATCHES.items():
    insert_node('BATCH', batch_vertex, data_provider_id)
    
for key, transaction_vertex in TRANSACTIONS.items():
    insert_node('TRANSACTION', transaction_vertex, data_provider_id)

for key, event_vertex in EVENTS.items():
    insert_node('VISIBILITY_EVENT', event_vertex, data_provider_id)

for owned_by_relation in OWNED_BY:
    insert_edge('OWNED_BY', owned_by_relation, data_provider_id)
    
for at_relation in AT:
    insert_edge('AT', at_relation, data_provider_id)
    
for input_batch_relation in INPUT_BATCH:
    insert_edge('INPUT_BATCH', input_batch_relation, data_provider_id)
    
for output_batch_relation in OUTPUT_BATCH:
    insert_edge('OUTPUT_BATCH', output_batch_relation, data_provider_id)

for instance_of_relation in INSTANCE_OF:
    insert_edge('INSTANCE_OF', instance_of_relation, data_provider_id)

for of_batch_relation in OF_BATCH:
    insert_edge('OF_BATCH', of_batch_relation, data_provider_id)
    
for sent_from_relation in FROM:
    insert_edge('FROM', sent_from_relation, data_provider_id)
    
for sent_to_relation in TO:
    insert_edge('TO', sent_to_relation, data_provider_id)

for traced_by_relation in TRACED_BY:
    insert_edge('TRACED_BY', traced_by_relation, data_provider_id)

print(dumps({"message": "Data import complete!", "batches": BATCHES}))
sys.stdout.flush()

for key, transaction in TRANSACTIONS.items():
    if 'TransactionFlow' in transaction['data']:
        joinTransactions(transaction, data_provider_id)
