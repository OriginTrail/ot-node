const parseString = require('xml2js').parseString;
const fs = require('fs');
const md5 = require('md5');

let xml;
const db = require('./database')();
const utilities = require('./utilities');
const async = require('async');


// //find function

function findValuesHelper(obj, key, list) {
    if (!obj) return list;
    if (obj instanceof Array) {
        for (var i in obj) {
            list = list.concat(findValuesHelper(obj[i], key, []));
        }
        return list;
    }
    if (obj[key]) list.push(obj[key]);

    if ((typeof obj === 'object') && (obj !== null)) {
        var children = Object.keys(obj);
        if (children.length > 0) {
            for (i = 0; i < children.length; i++) {
                list = list.concat(findValuesHelper(obj[children[i]], key, []));
            }
        }
    }
    return list;
}

// sanitize

function sanitize(old_obj, new_obj, patterns) {
    if (typeof old_obj !== 'object') { return old_obj; }

    for (const key in old_obj) {
        var new_key = key;

        for (const i in patterns) {
            new_key = new_key.replace(patterns[i], '');
        }

        new_obj[new_key] = sanitize(old_obj[key], {}, patterns);
    }

    return new_obj;
}

// parsing

function Error(message) {
    console.log(`Error: ${message}`);
    return false;
}

module.exports = function () {
    return {
        parseGS1(gs1_xml_file, callback) {
            var gs1_xml = fs.readFileSync(gs1_xml_file);
            parseString(gs1_xml, { explicitArray: false, mergeAttrs: true }, async function (err, result) {

                //Variables
                let EPCISDocument_element = [];
                var sanitized_EPCIS_document;
                let EPCISHeader_element;
                let StandardBusinessDocumentHeader_element;
                let Sender_element;
                let sender_id_element;
                let ContactInformation_element;
                let Receiver_element;
                let receiver_id_element;
                let ContactInformation_element_receiver;
                let DocumentIdentification_element;
                let BusinessScope_element;
                let sender_id;
                let receiver_id;

                let extension_element;
                let EPCISMasterData_element;
                let VocabularyList_element;
                let Vocabulary_elements;
                let vocabulary_element;
                let inside;
                var Bussines_location_elements;
                let VocabularyElementList_element;
                let business_location_id;
                let attribute_id;


                let data_object = {};
                let participants_data = {};
                let object_data = {};
                let batch_data = {};


                var sender = {};
                var receiver = {};
                var document_meta = {};
                var locations = {};
                var participants = {};
                var objects = {};
                var batches = {};


                let object_events = {};
                let aggregation_events = {};
                let transformation_events = {};


                var owned_by_edges = [];
                var instance_of_edges = [];
                var at_edges = [];
                var read_point_edges = [];
                var event_batch_edges = [];
                var parent_batches_edges = [];
                var child_batches_edges = [];
                var input_batches_edges = [];
                var output_batches_edges = [];
                var business_location_edges = [];

                //READING EPCIS Document
                let doc = findValuesHelper(result, 'epcis:EPCISDocument', []);
                if (doc.length <= 0) {
                    return Error('Missing EPCISDocument element!');
                } else {

                    EPCISDocument_element = result['epcis:EPCISDocument'];

                    let new_obj = {};
                    sanitized_EPCIS_document = sanitize(EPCISDocument_element, new_obj, ['sbdh:', 'xmlns:']);

                }

                let head = findValuesHelper(sanitized_EPCIS_document, 'EPCISHeader', []);
                if (head.length <= 0) {
                    return Error('Missing EPCISHeader element for EPCISDocument element!');
                } else {
                    EPCISHeader_element = sanitized_EPCIS_document.EPCISHeader;
                }

                let standard_doc_header = findValuesHelper(EPCISHeader_element, 'StandardBusinessDocumentHeader', []);
                if (standard_doc_header.length <= 0) {
                    return Error('Missing StandardBusinessDocumentHeader element for EPCISHeader element!');
                } else {
                    StandardBusinessDocumentHeader_element = EPCISHeader_element.StandardBusinessDocumentHeader;

                }

                ////SENDER
                let send = findValuesHelper(StandardBusinessDocumentHeader_element, 'Sender', []);
                if (send.length <= 0) {
                    return Error('Missing Sender element for StandardBusinessDocumentHeader element!');
                } 
                    Sender_element = StandardBusinessDocumentHeader_element.Sender;

                

                let send_id = findValuesHelper(Sender_element, 'Identifier', []);
                if (send_id.length <= 0) {
                    return Error('Missing Identifier element for Sender element!');
                } else {
                    sender_id_element = Sender_element.Identifier;

                }

                let sendid = findValuesHelper(sender_id_element, '_', []);
                if (sendid.length <= 0) {
                    return Error('Missing _ element for sender_id element!');
                } else {
                    sender_id = sender_id_element['_'];
                }

                let contact_info = findValuesHelper(Sender_element, 'ContactInformation', []);
                if (contact_info.length <= 0) {
                    return Error('Missing ContactInformation element for Sender element!');
                } else {
                    ContactInformation_element = Sender_element.ContactInformation;

                }


                /////RECEIVER
                let receive = findValuesHelper(StandardBusinessDocumentHeader_element, 'Receiver', []);
                if (receive.length <= 0) {
                    return Error('Missing Receiver element for StandardBusinessDocumentHeader element!');
                } else {
                    Receiver_element = StandardBusinessDocumentHeader_element.Receiver;

                }

                let receive_id = findValuesHelper(Receiver_element, 'Identifier', []);
                if (receive_id.length <= 0) {
                    return Error('Missing Identifier element for Receiver element!');
                } else {
                    receiver_id_element = Receiver_element.Identifier;

                }

                let receiveid = findValuesHelper(receiver_id_element, '_', []);
                if (receiveid.length <= 0) {
                    return Error('Missing Identifier element for Receiver element!');
                } else {
                    receiver_id = receiver_id_element['_'];

                }


                let contact_info_rec = findValuesHelper(Receiver_element, 'ContactInformation', []);
                if (contact_info_rec.length <= 0) {
                    return Error('Missing ContactInformation element for Receiver element!');
                } else {
                    ContactInformation_element_receiver = Receiver_element.ContactInformation;

                }

                let doc_identification = findValuesHelper(StandardBusinessDocumentHeader_element, 'DocumentIdentification', []);
                if (doc_identification.length <= 0) {
                    return Error('Missing DocumentIdentification element for StandardBusinessDocumentHeader element!');
                } else {
                    DocumentIdentification_element = StandardBusinessDocumentHeader_element.DocumentIdentification;

                }

                let bus_scope = findValuesHelper(StandardBusinessDocumentHeader_element, 'BusinessScope', []);
                if (bus_scope.length <= 0) {
                    return Error('Missing BusinessScope element for StandardBusinessDocumentHeader element!');
                } else {
                    BusinessScope_element = StandardBusinessDocumentHeader_element.BusinessScope;

                }


                sender['sender_id'] = {};
                sender['sender_id']['identifiers'] = {};
                sender['sender_id']['identifiers']['sender_id'] = sender_id;
                sender['sender_id']['identifiers']['uid'] = sender_id;
                sender['sender_id']['data'] = ContactInformation_element;
                sender['sender_id']['vertex_type'] = 'SENDER';


                receiver['receiver_id'] = {};
                receiver['receiver_id']['identifiers'] = {};
                receiver['receiver_id']['identifiers']['receiver_id'] = receiver_id;
                receiver['receiver_id']['data'] = ContactInformation_element_receiver;
                receiver['receiver_id']['vertex_type'] = 'RECEIVER';

                ///BUSINESS SCOPE AND DOCUMENT IDENTIFICATION

                document_meta = Object.assign({}, document_meta, {BusinessScope_element, DocumentIdentification_element});


                /////////////READING Master Data///////////

                let ext = findValuesHelper(EPCISHeader_element, 'extension', []);
                if (ext.length <= 0) {
                    return Error('Missing extension element for EPCISHeader element!');
                } else {
                    extension_element = EPCISHeader_element.extension;
                }

                let epcis_master = findValuesHelper(extension_element, 'EPCISMasterData', []);
                if (epcis_master.length <= 0) {
                    return Error('Missing EPCISMasterData element for extension element!');
                } else {
                    EPCISMasterData_element = extension_element.EPCISMasterData;
                }

                let vocabulary_li = findValuesHelper(EPCISMasterData_element, 'VocabularyList', []);
                if (vocabulary_li.length <= 0) {
                    return Error('Missing VocabularyList element for EPCISMasterData element!');
                } else {
                    VocabularyList_element = EPCISMasterData_element.VocabularyList;
                }

                let vocabulary = findValuesHelper(VocabularyList_element, 'Vocabulary', []);
                if (vocabulary.length <= 0) {
                    return Error('Missing Vocabulary element for VocabularyList element!');
                } else {
                    Vocabulary_elements = VocabularyList_element.Vocabulary;
                }

                if (!(Vocabulary_elements instanceof Array)) {
                    let temp_vocabulary_elements = Vocabulary_elements;
                    Vocabulary_elements = [];
                    Vocabulary_elements.push(temp_vocabulary_elements);
                }


                for (let i in Vocabulary_elements) {
                    vocabulary_element = Vocabulary_elements[i];

                    if (!(vocabulary_element instanceof Array)) {
                        let temp_vocabularyel_elements = vocabulary_element;
                        vocabulary_element = [];
                        vocabulary_element.push(temp_vocabularyel_elements);
                    }

                    for (let j in vocabulary_element) {
                        inside = vocabulary_element[j];
                        let pro;

                        for (j in inside) {
                            pro = inside[j];

                            let typ = findValuesHelper(pro, 'type', []);
                            if (typ.length <= 0) {
                                return Error('Missing type element for element!');
                            } else {
                                let v_type;
                                v_type = pro.type;

                                //////////BUSINESS_LOCATION/////////////
                                if (v_type == 'urn:epcglobal:epcis:vtype:BusinessLocation') {
                                    Bussines_location_elements = pro;

                                    let voc_el_list = findValuesHelper(Bussines_location_elements, 'VocabularyElementList', []);
                                    if (voc_el_list.length == 0) {
                                        return Error('Missing VocabularyElementList element for element!');
                                    } else {
                                        VocabularyElementList_element = Bussines_location_elements.VocabularyElementList;
                                    }


                                    for (let k in VocabularyElementList_element) {

                                        data_object = {};

                                        let VocabularyElement_element;
                                        VocabularyElement_element = VocabularyElementList_element[k];
                                        // console.log(VocabularyElement_element)

                                        for (let x in VocabularyElement_element) {
                                            let v;
                                            v = VocabularyElement_element[x];
                                            // console.log(v)

                                            let loc_id = findValuesHelper(v, 'id', []);
                                            if (loc_id.length <= 0) {
                                                return Error('Missing id element for VocabularyElement element!');
                                            } else {
                                                let str = v.id;
                                                business_location_id = str.replace('urn:epc:id:sgln:', '');
                                            }

                                            let attr = findValuesHelper(v, 'attribute', []);
                                            if (attr.length <= 0) {
                                                return Error('Missing attribute element for VocabularyElement element!');
                                            } else {
                                                let attribute;
                                                attribute = v.attribute;

                                                for (let y in attribute) {
                                                    let kk;
                                                    kk = attribute[y];


                                                    let att_id = findValuesHelper(kk, 'id', []);
                                                    if (att_id.length <= 0) {
                                                        return Error('Missing id attribute for element!');
                                                    } 
                                                        let str = kk.id;
                                                        attribute_id = str;
                                                    

                                                    data_object[attribute_id] = kk['_'];

                                                }
                                            }
                                            var children_elements;
                                            let children_check = findValuesHelper(v, 'children', []);
                                            if (children_check.length == 0) {
                                                return Error('Missing children element for element!');
                                            } 
                                                children_elements = v.children;
                                            

                                            if (findValuesHelper(children_elements, 'id', []).length == 0) {
                                                return Error('Missing id element in children element for business location!');
                                            }

                                            let children_id = children_elements.id;
                                            var child_id_obj;
                                            var child_location_id;
                                            for (let mn in children_id) {
                                                child_id_obj = (children_id[mn]);

                                                if (!(child_id_obj instanceof Array)) {
                                                    let temp_child_id = child_id_obj;
                                                    child_id_obj = [];
                                                    child_id_obj.push(temp_child_id);
                                                }

                                                for (let r in child_id_obj) {
                                                    child_location_id = child_id_obj[r];

                                                    business_location_edges.push({
                                                        '_key': md5('child_business_location_' + sender_id + '_' + child_location_id + '_' + business_location_id),
                                                        '_from': 'ot_vertices/' + md5('business_location_' + sender_id + '_' + child_location_id),
                                                        '_to': 'ot_vertices/' + md5('business_location_' + sender_id + '_' + business_location_id),
                                                        'edge_type': 'CHILD_BUSINESS_LOCATION'
                                                    });

                                                    locations[child_location_id] = {};
                                                    locations[child_location_id]['identifiers'] = {};
                                                    locations[child_location_id]['identifiers']['bussines_location_id'] = child_location_id;
                                                    locations[child_location_id]['identifiers']['uid'] = child_location_id;
                                                    locations[child_location_id]['vertex_type'] = 'BUSINESS_LOCATION';
                                                    locations[child_location_id]['_key'] = md5('business_location_' + sender_id + '_' + child_location_id);

                                                }
                                            }

                                            if (findValuesHelper(v, 'extension', []).length != 0) {
                                                let attr = findValuesHelper(v.extension, 'attribute', []);
                                                if (attr.length != 0) {
                                                    let ext_attribute;
                                                    ext_attribute = v.extension.attribute;

                                                    if (ext_attribute.length == undefined) {
                                                        ext_attribute = [ext_attribute];
                                                    }

                                                    for (let y in ext_attribute) {
                                                        let kk;
                                                        kk = ext_attribute[y];


                                                        let att_id = findValuesHelper(kk, 'id', []);
                                                        if (att_id.length <= 0) {
                                                            return Error('Missing id attribute for element!');
                                                        } 
                                                            let str = kk.id;
                                                            attribute_id = str;
                                                        

                                                        attribute_id = attribute_id.replace('urn:ot:location:', '');
                                                        console.log(kk['_']);

                                                        if (attribute_id == 'participantId') {
                                                            owned_by_edges.push({
                                                                '_from': 'ot_vertices/' + md5('business_location_' + sender_id + '_' + business_location_id),
                                                                '_to': 'ot_vertices/' + md5('participant_' + sender_id + '_' + kk['_']),
                                                                'edge_type': 'OWNED_BY',
                                                                '_key': md5('owned_by_' + sender_id + '_' + business_location_id + '_' + kk['_'])
                                                            });
                                                        }

                                                    }
                                                }
                                            }


                                            locations[business_location_id] = {};
                                            locations[business_location_id]['identifiers'] = {};
                                            locations[business_location_id]['identifiers']['bussines_location_id'] = business_location_id;
                                            locations[business_location_id]['identifiers']['uid'] = business_location_id;
                                            locations[business_location_id]['data'] = utilities.copyObject(data_object);
                                            locations[business_location_id]['vertex_type'] = 'BUSINESS_LOCATION';
                                            locations[business_location_id]['_key'] = md5('business_location_' + sender_id + '_' + business_location_id);

                                        }
                                    }
                                }

                                var Participant_elements;
                                var exten_element;
                                var OTVocabularyElement_element;
                                var participant_id;
                                var attribute_elements;
                                ///////PARTICIPANT///////////
                                if (v_type == 'urn:ot:mda:participant') {
                                    Participant_elements = pro;

                                    let extension_check = findValuesHelper(Participant_elements, 'extension', []);
                                    if (extension_check.length == 0) {
                                        return Error('Missing extension element for Participant element!');
                                    } 
                                        exten_element = Participant_elements.extension;
                                    

                                    let ot_voc_check = findValuesHelper(exten_element, 'OTVocabularyElement', []);
                                    if (ot_voc_check.length == 0) {
                                        return Error('Missing OTVocabularyElement for extension element!');
                                    } 
                                        OTVocabularyElement_element = exten_element.OTVocabularyElement;
                                    

                                    let participant_id_check = findValuesHelper(OTVocabularyElement_element, 'id', []);
                                    if (participant_id_check.length == 0) {
                                        return Error('Missing id for Participant element!');
                                    } 
                                        participant_id = OTVocabularyElement_element.id;
                                    

                                    let attribute_check = findValuesHelper(OTVocabularyElement_element, 'attribute', []);
                                    if (attribute_check.length == 0) {
                                        return Error('Missing attribute for Participant element!');
                                    } 
                                        attribute_elements = OTVocabularyElement_element.attribute;
                                    

                                    participants_data = {};

                                    for (let zx in attribute_elements) {
                                        let attribute_el = attribute_elements[zx];

                                        var value;
                                        let value_check = findValuesHelper(attribute_el, '_', []);
                                        if (value_check.length == 0) {
                                            return Error('Missing value for attribute element!');
                                        } 
                                            value = attribute_el['_'];
                                        

                                        var attr_id;
                                        let attr_id_check = findValuesHelper(attribute_el, 'id', []);
                                        if (attr_id_check.length == 0) {
                                            return Error('Missing id element for attribute element!');
                                        } else {
                                            attr_id = attribute_el.id.replace('urn:ot:mda:participant:', '');
                                        }

                                        participants_data[attr_id] = value;
                                    }

                                    participants[participant_id] = {};
                                    participants[participant_id]['identifiers'] = {};
                                    participants[participant_id]['identifiers']['participant_id'] = participant_id;
                                    participants[participant_id]['identifiers']['uid'] = participant_id;
                                    participants[participant_id]['data'] = utilities.copyObject(participants_data);
                                    participants[participant_id]['vertex_type'] = 'PARTICIPANT';
                                    participants[participant_id]['_key'] = md5('participant_' + sender_id + '_' + participant_id);
                                }


                                var Object_elements;
                                //////OBJECT////////
                                if (v_type == 'urn:ot:mda:object') {
                                    Object_elements = pro;

                                    var extensio_element;
                                    let extensio_check = findValuesHelper(Object_elements, 'extension', []);
                                    if (extensio_check.length == 0) {
                                        return Error('Missing extension element for Object element!');
                                    } else {
                                        extensio_element = Object_elements.extension;
                                    }

                                    var OTVocabularyEl;
                                    let OTVocabularyEl_check = findValuesHelper(extensio_element, 'OTVocabularyElement', []);
                                    if (OTVocabularyEl_check.length == 0) {
                                        return Error('Missing OTVocabularyElement element for extension element!');
                                    } else {
                                        OTVocabularyEl = extensio_element.OTVocabularyElement;
                                    }

                                    var object_id;
                                    let object_id_check = findValuesHelper(OTVocabularyEl, 'id', []);
                                    if (object_id_check.length == 0) {
                                        return Error('Missing id element for OTVocabularyElement!');
                                    } else {
                                        object_id = OTVocabularyEl.id;
                                    }

                                    var object_attribute_elements;
                                    let attribute_el_check = findValuesHelper(OTVocabularyEl, 'attribute', []);
                                    if (attribute_el_check.length == 0) {
                                        return Error('Missing attribute element for OTVocabularyElement!');
                                    } else {
                                        object_attribute_elements = OTVocabularyEl.attribute;
                                    }

                                    for (let rr in object_attribute_elements) {
                                        var single_attribute;
                                        single_attribute = object_attribute_elements[rr];

                                        var single_attribute_id;
                                        let single_attribute_id_check = findValuesHelper(single_attribute, 'id', []);
                                        if (single_attribute_id_check.length == 0) {
                                            return Error('Missing id element for attribute element!');
                                        } else {
                                            single_attribute_id = single_attribute.id;
                                        }

                                        var single_attribute_value;
                                        let single_attribute_value_check = findValuesHelper(single_attribute, '_', []);
                                        if (single_attribute_value_check.length == 0) {
                                            return Error('Missing value element for attribute element!');
                                        } else {
                                            single_attribute_value = single_attribute['_'];
                                        }

                                        object_data[single_attribute_id] = single_attribute_value;
                                        let new_obj = {};
                                        let sanitized_object_data = sanitize(object_data, new_obj, ['urn:', 'ot:', 'mda:', 'object:']);


                                        objects[object_id] = {};
                                        objects[object_id]['identifiers'] = {};
                                        objects[object_id]['identifiers']['object_id'] = object_id;
                                        objects[object_id]['data'] = utilities.copyObject(sanitized_object_data);
                                        objects[object_id]['vertex_type'] = 'OBJECT';
                                        objects[object_id]['_key'] = md5('object_' + sender_id + '_' + object_id);
                                    }
                                }

                                var Batch_elements;
                                ////////BATCH/////////
                                if (v_type == 'urn:ot:mda:batch') {
                                    Batch_elements = pro;

                                    var batch_extension;
                                    let batch_extension_check = findValuesHelper(Batch_elements, 'extension', []);
                                    if (batch_extension_check.length == 0) {
                                        return Error('Missing extension element for Batch element!');
                                    } else {
                                        batch_extension = Batch_elements.extension;
                                    }

                                    var OTVoc_El_elements;
                                    let OTVoc_El_elements_check = findValuesHelper(batch_extension, 'OTVocabularyElement', []);
                                    if (OTVoc_El_elements_check.length == 0) {
                                        return Error('Missing OTVocabularyElement element for extension element!');
                                    } else {
                                        OTVoc_El_elements = batch_extension.OTVocabularyElement;
                                    }

                                    var ot_vocabulary_element;
                                    for (let g in OTVoc_El_elements) {
                                        ot_vocabulary_element = OTVoc_El_elements[g];

                                        var batch_id;
                                        let batch_id_element_check = findValuesHelper(ot_vocabulary_element, 'id', []);
                                        if (batch_id_element_check.length == 0) {
                                            return Error('Missing id element for OTVocabularyElement!');
                                        } else {
                                            batch_id = ot_vocabulary_element.id;
                                        }

                                        var batch_attribute_el;
                                        let batch_attribute_el_check = findValuesHelper(ot_vocabulary_element, 'attribute', []);
                                        if (batch_attribute_el_check.length == 0) {
                                            return Error('Missing attribute element for OTVocabularyElement!');
                                        } else {
                                            batch_attribute_el = ot_vocabulary_element.attribute;
                                        }

                                        var single;
                                        for (let one in batch_attribute_el) {
                                            single = batch_attribute_el[one];

                                            var batch_attribute_id;
                                            let batch_attribute_id_check = findValuesHelper(single, 'id', []);
                                            if (batch_attribute_id_check.length == 0) {
                                                return Error('Missing id element for attribute element!');
                                            } else {
                                                batch_attribute_id = single.id;
                                            }

                                            var batch_attribute_value;
                                            let batch_attribute_value_check = findValuesHelper(single, '_', []);
                                            if (batch_attribute_value_check.length == 0) {
                                                return Error('Missing value element for attribute element!');
                                            } else {
                                                batch_attribute_value = single['_'];
                                            }

                                            batch_data[batch_attribute_id] = batch_attribute_value;

                                            let new_obj = {};
                                            let sanitized_batch_data = sanitize(batch_data, new_obj, ['urn:', 'ot:', 'mda:', 'batch:']);

                                            if (sanitized_batch_data.objectid != undefined) {
                                                instance_of_edges.push({
                                                    '_from': 'ot_vertices/' + md5('batch_' + sender_id + '_' + batch_id),
                                                    '_to': 'ot_vertices/' + md5('object_' + sender_id + '_' + object_id),
                                                    '_key': md5('object_' + sender_id + '_' + '_' + batch_id + object_id),
                                                    'edge_type': 'INSTANCE_OF'
                                                });
                                            }


                                            batches[batch_id] = {};
                                            batches[batch_id]['identifiers'] = {};
                                            batches[batch_id]['identifiers']['batch_id'] = batch_id;
                                            batches[batch_id]['identifiers']['uid'] = batch_id;
                                            batches[batch_id]['data'] = utilities.copyObject(sanitized_batch_data);
                                            batches[batch_id]['vertex_type'] = 'BATCH';
                                            batches[batch_id]['_key'] = md5('batch_' + sender_id + '_' + batch_id);

                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                //READING EPCIS Document Body

                if (findValuesHelper(EPCISDocument_element, 'EPCISBody', []).length != 0) {

                    let body_element = EPCISDocument_element.EPCISBody;

                    if (findValuesHelper(result, 'EventList', []).length == 0) {
                        return Error('Missing EventList element');
                    }

                    var event_list_element = body_element.EventList;


                    for (var event_type in event_list_element) {

                        let events = [];

                        if (event_list_element[event_type].length == undefined) {
                            events = [event_list_element[event_type]];
                        }
                        else {
                            events = event_list_element[event_type];
                        }


                        for (let i in events) {

                            let event_batches = [];

                            let event = events[i];

                            if (event_type == 'ObjectEvent') {

                                // eventTime
                                if (findValuesHelper(event, 'eventTime', []).length == 0) {
                                    return Error('Missing eventTime element for event!');
                                }

                                let event_time = event.eventTime;

                                if (typeof event_time != 'string') {
                                    return Error('Multiple eventTime elements found!');
                                }

                                // eventTimeZoneOffset
                                if (findValuesHelper(event, 'eventTimeZoneOffset', []).length == 0) {
                                    return Error('Missing event_time_zone_offset element for event!');
                                }

                                let event_time_zone_offset = event.eventTimeZoneOffset;

                                if (typeof event_time_zone_offset != 'string') {
                                    return Error('Multiple event_time_zone_offset elements found!');
                                }

                                let event_id = sender_id + ':' + event_time + 'Z' + event_time_zone_offset;

                                // baseExtension + eventID
                                if (findValuesHelper(event, 'baseExtension', []).length > 0) {
                                    let baseExtension_element = event.baseExtension;


                                    if (findValuesHelper(baseExtension_element, 'eventID', []).length == 0) {
                                        return Error('Missing eventID in baseExtension!');
                                    }

                                    event_id = baseExtension_element.eventID;
                                }

                                // epcList
                                if (findValuesHelper(event, 'epcList', []).length == 0) {
                                    return Error('Missing epcList element for event!');
                                }

                                let epcList = event.epcList;

                                if (findValuesHelper(epcList, 'epc', []).length == 0) {
                                    return Error('Missing epc element in epcList for event!');
                                }

                                let epc = epcList.epc;

                                if (typeof epc == 'string') {
                                    event_batches = [epc];
                                }
                                else {
                                    event_batches = epc;
                                }

                                // readPoint
                                let read_point = undefined;
                                if (findValuesHelper(event, 'readPoint', []).length != 0) {
                                    let read_point_element = event.readPoint;

                                    if (findValuesHelper(read_point_element, 'id', []).length == 0) {
                                        return Error('Missing id for readPoint!');
                                    }

                                    read_point = read_point_element.id;
                                }

                                console.log(read_point);

                                // bizLocation
                                let biz_location = undefined;
                                if (findValuesHelper(event, 'bizLocation', []).length != 0) {
                                    let biz_location_element = event.bizLocation;

                                    if (findValuesHelper(biz_location_element, 'id', []).length == 0) {
                                        return Error('Missing id for bizLocation!');
                                    }

                                    biz_location = biz_location_element.id;
                                }

                                let object_event = {
                                    identifiers: {
                                        event_id: event_id,
                                        uid: event_id
                                    },
                                    data: event,
                                    vertex_type: 'EVENT',
                                    _key: md5('event_' + sender_id + '_' + event_id)
                                };

                                object_events[event_id] = utilities.copyObject(object_event);

                                for (let bi in event_batches) {
                                    event_batch_edges.push({
                                        '_key': md5('event_batch_' + sender_id + '_' + event_id + '_' + event_batches[bi]),
                                        '_from': 'ot_vertices/' + md5('batch_' + sender_id + '_' + event_batches[bi]),
                                        '_to': 'ot_vertices/' + md5('event_' + sender_id + '_' + event_id),
                                        'edge_type': 'EVENT_BATCHES'
                                    });
                                }

                                if (read_point != undefined) {
                                    read_point_edges.push({
                                        '_key': md5('read_point_' + sender_id + '_' + event_id + '_' + read_point),
                                        '_from': 'ot_vertices/' + md5('event_' + sender_id + '_' + event_id),
                                        '_to': 'ot_vertices/' + md5('business_location_' + sender_id + '_' + read_point),
                                        'edge_type': 'READ_POINT'
                                    });
                                }

                                if (biz_location != undefined) {
                                    at_edges.push({
                                        '_key': md5('at_' + sender_id + '_' + event_id + '_' + biz_location),
                                        '_from': 'ot_vertices/' + md5('event_' + sender_id + '_' + event_id),
                                        '_to': 'ot_vertices/' + md5('business_location_' + sender_id + '_' + biz_location),
                                        'edge_type': 'AT'
                                    });
                                }


                            }
                            else if (event_type == 'AggregationEvent') {

                                // eventTime
                                if (findValuesHelper(event, 'eventTime', []).length == 0) {
                                    return Error('Missing eventTime element for event!');
                                }

                                let event_time = event.eventTime;

                                if (typeof event_time != 'string') {
                                    return Error('Multiple eventTime elements found!');
                                }

                                // eventTimeZoneOffset
                                if (findValuesHelper(event, 'eventTimeZoneOffset', []).length == 0) {
                                    return Error('Missing event_time_zone_offset element for event!');
                                }

                                let event_time_zone_offset = event.eventTimeZoneOffset;

                                if (typeof event_time_zone_offset != 'string') {
                                    return Error('Multiple event_time_zone_offset elements found!');
                                }

                                let event_id = sender_id + ':' + event_time + 'Z' + event_time_zone_offset;

                                // baseExtension + eventID
                                if (findValuesHelper(event, 'baseExtension', []).length > 0) {
                                    let baseExtension_element = event.baseExtension;


                                    if (findValuesHelper(baseExtension_element, 'eventID', []).length == 0) {
                                        return Error('Missing eventID in baseExtension!');
                                    }

                                    event_id = baseExtension_element.eventID;
                                }

                                // parentID
                                if (findValuesHelper(event, 'parentID', []).length == 0) {
                                    return Error('Missing parentID element for Aggregation event!');
                                }

                                let parent_id = event.parentID;

                                // childEPCs
                                let child_epcs = [];

                                if (findValuesHelper(event, 'childEPCs', []).length == 0) {
                                    return Error('Missing childEPCs element for event!');
                                }

                                let epcList = event.childEPCs;

                                if (findValuesHelper(epcList, 'epc', []).length == 0) {
                                    return Error('Missing epc element in epcList for event!');
                                }

                                let epc = epcList.epc;
                                // console.log(epc);
                                if (typeof epc == 'string') {
                                    child_epcs = [epc];
                                }
                                else {
                                    child_epcs = epc;
                                }

                                // readPoint
                                let read_point = undefined;
                                if (findValuesHelper(event, 'readPoint', []).length != 0) {
                                    let read_point_element = event.readPoint;

                                    if (findValuesHelper(read_point_element, 'id', []).length == 0) {
                                        return Error('Missing id for readPoint!');
                                    }

                                    read_point = read_point_element.id;
                                }

                                // bizLocation
                                let biz_location = undefined;
                                if (findValuesHelper(event, 'bizLocation', []).length != 0) {
                                    let biz_location_element = event.bizLocation;

                                    if (findValuesHelper(biz_location_element, 'id', []).length == 0) {
                                        return Error('Missing id for bizLocation!');
                                    }

                                    biz_location = biz_location_element.id;
                                }

                                let aggregation_event = {
                                    identifiers: {
                                        event_id: event_id,
                                        uid: event_id
                                    },
                                    data: event,
                                    vertex_type: 'EVENT',
                                    _key: md5('event_' + sender_id + '_' + event_id)
                                };

                                console.log(child_epcs);
                                aggregation_events[event_id] = utilities.copyObject(aggregation_event);

                                for (let bi in child_epcs) {
                                    child_batches_edges.push({
                                        '_key': md5('child_batch_' + sender_id + '_' + event_id + '_' + child_epcs[bi]),
                                        '_from': 'ot_vertices/' + md5('event_' + sender_id + '_' + event_id),
                                        '_to': 'ot_vertices/' + md5('batch_' + sender_id + '_' + child_epcs[bi]),
                                        'edge_type': 'CHILD_BATCH'
                                    });
                                }

                                if (read_point != undefined) {
                                    read_point_edges.push({
                                        '_key': md5('read_point_' + sender_id + '_' + event_id + '_' + read_point),
                                        '_from': 'ot_vertices/' + md5('event_' + sender + '_' + event_id),
                                        '_to': 'ot_vertices/' + md5('business_location_' + sender_id + '_' + read_point),
                                        'edge_type': 'READ_POINT'

                                    });
                                }

                                if (biz_location != undefined) {
                                    at_edges.push({
                                        '_key': md5('at_' + sender_id + '_' + event_id + '_' + biz_location),
                                        '_from': 'ot_vertices/' + md5('event_' + sender_id + '_' + event_id),
                                        '_to': 'ot_vertices/' + md5('business_location_' + sender_id + '_' + biz_location),
                                        'edge_type': 'AT'
                                    });
                                }

                                parent_batches_edges.push({
                                    '_key': md5('at_' + sender_id + '_' + event_id + '_' + biz_location),
                                    '_from': 'ot_vertices/' + md5('batch_' + sender_id + '_' + parent_id),
                                    '_to': 'ot_vertices/' + md5('event_' + sender_id + '_' + event_id),
                                    'edge_type': 'PARENT_BATCH'
                                });

                            }
                            else if (event_type == 'extension') {
                                let extension_events = event;

                                for (var ext_event_type in extension_events) {

                                    let ext_events = [];

                                    if (extension_events[ext_event_type].length == undefined) {
                                        ext_events = [extension_events[ext_event_type]];
                                    }
                                    else {
                                        ext_events = event_list_element[ext_event_type];
                                    }


                                    for (let i in ext_events) {

                                        let ext_event = ext_events[i];

                                        if (ext_event_type == 'TransformationEvent') {

                                            // eventTime
                                            if (findValuesHelper(ext_event, 'transformationID', []).length == 0) {
                                                return Error('Missing transformationID element for event!');
                                            }

                                            let ext_event_id = ext_event.transformationID;

                                            // inputEPCList
                                            let input_epcs = [];

                                            if (findValuesHelper(ext_event, 'inputEPCList', []).length == 0) {
                                                return Error('Missing inputEPCList element for event!');
                                            }

                                            let epcList = ext_event.inputEPCList;

                                            if (findValuesHelper(epcList, 'epc', []).length == 0) {
                                                return Error('Missing epc element in epcList for event!');
                                            }

                                            let epc = epcList.epc;

                                            if (typeof epc == 'string') {
                                                input_epcs = [epc];
                                            }
                                            else {
                                                input_epcs = epc;
                                            }

                                            // outputEPCList
                                            let output_epcs = [];

                                            if (findValuesHelper(ext_event, 'outputEPCList', []).length != 0) {
                                                let epcList = ext_event.outputEPCList;

                                                if (findValuesHelper(epcList, 'epc', []).length == 0) {
                                                    return Error('Missing epc element in epcList for event!');
                                                }

                                                let epc = epcList.epc;

                                                if (typeof epc == 'string') {
                                                    output_epcs = [epc];
                                                }
                                                else {
                                                    output_epcs = epc;
                                                }
                                            }


                                            // readPoint
                                            let read_point = undefined;
                                            if (findValuesHelper(ext_event, 'readPoint', []).length != 0) {
                                                let read_point_element = ext_event.readPoint;

                                                if (findValuesHelper(read_point_element, 'id', []).length == 0) {
                                                    return Error('Missing id for readPoint!');
                                                }

                                                read_point = read_point_element.id;
                                            }

                                            let transformation_event = {
                                                identifiers: {
                                                    event_id: ext_event_id,
                                                    uid: ext_event_id
                                                },
                                                data: ext_event,
                                                vertex_type: 'EVENT',
                                                _key: md5('event_' + sender_id + '_' + ext_event_id)
                                            };

                                            transformation_events[ext_event_id] = utilities.copyObject(transformation_event);

                                            // bizLocation
                                            let biz_location = undefined;
                                            if (findValuesHelper(ext_event, 'bizLocation', []).length != 0) {
                                                let biz_location_element = ext_event.bizLocation;

                                                if (findValuesHelper(biz_location_element, 'id', []).length == 0) {
                                                    return Error('Missing id for bizLocation!');
                                                }

                                                biz_location = biz_location_element.id;
                                            }

                                            console.log(input_epcs);
                                            for (let bi in input_epcs) {
                                                input_batches_edges.push({
                                                    '_key': md5('child_batch_' + sender_id + '_' + ext_event_id + '_' + input_epcs[bi]),
                                                    '_from': 'ot_vertices/' + md5('event_' + sender_id + '_' + ext_event_id),
                                                    '_to': 'ot_vertices/' + md5('batch_' + sender_id + '_' + input_epcs[bi]),
                                                    'edge_type': 'INPUT_BATCH'
                                                });
                                            }

                                            for (let bi in output_epcs) {
                                                output_batches_edges.push({
                                                    '_key': md5('child_batch_' + sender_id + '_' + ext_event_id + '_' + output_epcs[bi]),
                                                    '_from': 'ot_vertices/' + md5('batch_' + sender_id + '_' + output_epcs[bi]),
                                                    '_to': 'ot_vertices/' + md5('event_' + sender_id + '_' + ext_event_id),
                                                    'edge_type': 'OUTPUT_BATCH'
                                                });
                                            }

                                            if (read_point != undefined) {
                                                read_point_edges.push({
                                                    '_key': md5('read_point_' + sender_id + '_' + ext_event_id + '_' + read_point),
                                                    '_from': 'ot_vertices/' + md5('event_' + sender_id + '_' + ext_event_id),
                                                    '_to': 'ot_vertices/' + md5('business_location_' + sender_id + '_' + read_point),
                                                    'edge_type': 'READ_POINT'

                                                });
                                            }

                                            if (biz_location != undefined) {
                                                at_edges.push({
                                                    '_key': md5('at_' + sender_id + '_' + ext_event_id + '_' + biz_location),
                                                    '_from': 'ot_vertices/' + md5('event_' + sender_id + '_' + ext_event_id),
                                                    '_to': 'ot_vertices/' + md5('business_location_' + sender_id + '_' + biz_location),
                                                    'edge_type': 'AT'
                                                });
                                            }


                                        } else {
                                            return Error('Unsupported event type: ' + event_type);
                                        }
                                    }

                                }


                            }
                            else {
                                return Error('Unsupported event type: ' + event_type);
                            }

                        }

                    }

                    var vertices = [];
                    var edges = [];

                    var temp_participants = [];
                    for (let i in participants) {
                        temp_participants.push(participants[i]);
                    }

                    async.each(temp_participants, function (participant, next) {
                        db.addVertex('ot_vertices', participant, function () {
                            vertices.push(participant);
                            next();
                        });
                    }, function () {
                        console.log('Writting participants complete');
                    });

                    var temp_objects = [];
                    for (let i in objects) {
                        temp_objects.push(objects[i]);
                    }

                    async.each(temp_objects, function (object, next) {
                        db.addVertex('ot_vertices', object, function () {
                            vertices.push(object);
                            next();
                        });
                    }, function () {
                        console.log('Writting objects complete');
                    });

                    var temp_locations = [];
                    for (let i in locations) {
                        temp_locations.push(locations[i]);
                    }

                    async.each(temp_locations, function (location, next) {
                        db.addVertex('ot_vertices', location, function () {
                            vertices.push(location);
                            next();
                        });
                    }, function () {
                        console.log('Writting business locations complete');
                    });

                    var temp_batches = [];
                    for (let i in batches) {
                        temp_batches.push(batches[i]);
                    }

                    async.each(temp_batches, function (batch, next) {
                        db.addVertex('ot_vertices', batch, function () {
                            vertices.push(batch);
                            next();
                        });
                    }, function () {
                        console.log('Writting batches complete');
                    });


                    var temp_object_events = [];
                    for (let i in object_events) {
                        temp_object_events.push(object_events[i]);
                    }

                    async.each(temp_object_events, function (event, next) {
                        db.addVertex('ot_vertices', event, function () {
                            vertices.push(event);
                            next();
                        });
                    }, function () {
                        console.log('Writting object events complete');
                    });

                    console.log(object_events);

                    var temp_aggregation_events = [];
                    for (let i in aggregation_events) {
                        temp_aggregation_events.push(aggregation_events[i]);
                    }

                    async.each(temp_aggregation_events, function (event, next) {
                        db.addVertex('ot_vertices', event, function () {
                            vertices.push(event);
                            next();
                        });
                    }, function () {
                        console.log('Writting aggregation events complete');
                    });

                    var temp_transformation_events = [];
                    for (let i in transformation_events) {
                        temp_transformation_events.push(transformation_events[i]);
                    }

                    async.each(temp_transformation_events, function (event, next) {
                        db.addVertex('ot_vertices', event, function () {
                            vertices.push(event);
                            next();
                        });
                    }, function () {
                        console.log('Writting transformation events complete');
                    });


                    async.each(instance_of_edges, function (input, next) {
                        db.addEdge('ot_edges', input, function () {
                            edges.push(input);
                            next();
                        });
                    }, function () {
                        console.log('Writting instance_of edges complete');
                    });

                    async.each(owned_by_edges, function (input, next) {
                        db.addEdge('ot_edges', input, function () {
                            edges.push(input);
                            next();
                        });
                    }, function () {
                        console.log('Writting owned_by edges complete');
                    });

                    async.each(at_edges, function (input, next) {
                        db.addEdge('ot_edges', input, function () {
                            edges.push(input);
                            next();
                        });
                    }, function () {
                        console.log('Writting at_edges complete');
                    });


                    async.each(read_point_edges, function (input, next) {
                        db.addEdge('ot_edges', input, function () {
                            edges.push(input);
                            next();
                        });
                    }, function () {
                        console.log('Writting read_point edges  complete');
                    });

                    async.each(event_batch_edges, function (input, next) {
                        db.addEdge('ot_edges', input, function () {
                            edges.push(input);
                            next();
                        });
                    }, function () {
                        console.log('Writting event_batch edges  complete');
                    });

                    async.each(parent_batches_edges, function (input, next) {
                        db.addEdge('ot_edges', input, function () {
                            edges.push(input);
                            next();
                        });
                    }, function () {
                        console.log('Writting parent_batches edges  complete');
                    });

                    async.each(child_batches_edges, function (input, next) {
                        db.addEdge('ot_edges', input, function () {
                            edges.push(input);
                            next();
                        });
                    }, function () {
                        console.log('Writting child_batches edges  complete');
                    });

                    async.each(input_batches_edges, function (input, next) {
                        db.addEdge('ot_edges', input, function () {
                            edges.push(input);
                            next();
                        });
                    }, function () {
                        console.log('Writting input_batches edges  complete');
                    });

                    async.each(output_batches_edges, function (input, next) {
                        db.addEdge('ot_edges', input, function () {
                            edges.push(input);
                            next();
                        });
                    }, function () {
                        console.log('Writting output_batches edges  complete');
                    });

                    async.each(business_location_edges, function (input, next) {
                        db.addEdge('ot_edges', input, function () {
                            edges.push(input);
                            next();
                        });
                    }, function () {
                        console.log('Writting business_location edges  complete');
                    });

                    utilities.executeCallback(callback, {vertices: vertices, edges: edges, import_id: Data.now()});

                }
            });
        },
    };
};

