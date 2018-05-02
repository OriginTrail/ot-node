const { parseString } = require('xml2js');
const fs = require('fs');
const md5 = require('md5');
const deasync = require('deasync-promise');

const GSInstance = require('./GraphStorageInstance');
const utilities = require('./Utilities');
const async = require('async');

// Update import data


function updateImportNumber(collection, document, importId) {
    const { db } = GSInstance;
    return db.updateDocumentImports(collection, document, importId);
}

/**
 * Find values helper
 * @param obj
 * @param key
 * @param list
 * @return {*}
 */
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
            for (i = 0; i < children.length; i += 1) {
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

module.exports = () => ({
    parseGS1(gs1_xml_file, callback) {
        const { db } = GSInstance;
        var gs1_xml = fs.readFileSync(gs1_xml_file);
        parseString(
            gs1_xml,
            { explicitArray: false, mergeAttrs: true },
            /* eslint-disable consistent-return */
            async (err, result) => {
                /**
                 * Variables
                 */

                var sanitized_EPCIS_document;

                let Vocabulary_elements;
                let vocabulary_element;
                let inside;
                var Bussines_location_elements;
                let VocabularyElementList_element;
                let business_location_id;
                let attribute_id;


                let data_object = {};
                let participants_data = {};
                const object_data = {};
                const batch_data = {};


                var sender = {};
                var receiver = {};
                var document_meta = {};
                var locations = {};
                var participants = {};
                var objects = {};
                var batches = {};


                const object_events = {};
                const aggregation_events = {};
                const transformation_events = {};


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

                // READING EPCIS Document
                const doc = findValuesHelper(result, 'epcis:EPCISDocument', []);
                if (doc.length <= 0) {
                    return Error('Missing EPCISDocument element!');
                }

                const EPCISDocument_element = result['epcis:EPCISDocument'];

                const new_obj = {};
                sanitized_EPCIS_document = sanitize(EPCISDocument_element, new_obj, ['sbdh:', 'xmlns:']);


                const head = findValuesHelper(sanitized_EPCIS_document, 'EPCISHeader', []);
                if (head.length <= 0) {
                    return Error('Missing EPCISHeader element for EPCISDocument element!');
                }
                const EPCISHeader_element = sanitized_EPCIS_document.EPCISHeader;


                const standard_doc_header = findValuesHelper(EPCISHeader_element, 'StandardBusinessDocumentHeader', []);
                if (standard_doc_header.length <= 0) {
                    return Error('Missing StandardBusinessDocumentHeader element for EPCISHeader element!');
                }
                const StandardBusinessDocumentHeader_element =
                    EPCISHeader_element.StandardBusinessDocumentHeader;


                // //SENDER
                const send = findValuesHelper(StandardBusinessDocumentHeader_element, 'Sender', []);
                if (send.length <= 0) {
                    return Error('Missing Sender element for StandardBusinessDocumentHeader element!');
                }
                const Sender_element = StandardBusinessDocumentHeader_element.Sender;


                const send_id = findValuesHelper(Sender_element, 'Identifier', []);
                if (send_id.length <= 0) {
                    return Error('Missing Identifier element for Sender element!');
                }
                const sender_id_element = Sender_element.Identifier;


                const sendid = findValuesHelper(sender_id_element, '_', []);
                if (sendid.length <= 0) {
                    return Error('Missing _ element for sender_id element!');
                }
                const sender_id = sender_id_element._;


                const contact_info = findValuesHelper(Sender_element, 'ContactInformation', []);
                if (contact_info.length <= 0) {
                    return Error('Missing ContactInformation element for Sender element!');
                }
                const ContactInformation_element = Sender_element.ContactInformation;


                // ///RECEIVER
                const receive = findValuesHelper(StandardBusinessDocumentHeader_element, 'Receiver', []);
                if (receive.length <= 0) {
                    return Error('Missing Receiver element for StandardBusinessDocumentHeader element!');
                }
                const Receiver_element = StandardBusinessDocumentHeader_element.Receiver;


                const receive_id = findValuesHelper(Receiver_element, 'Identifier', []);
                if (receive_id.length <= 0) {
                    return Error('Missing Identifier element for Receiver element!');
                }
                const receiver_id_element = Receiver_element.Identifier;


                const receiveid = findValuesHelper(receiver_id_element, '_', []);
                if (receiveid.length <= 0) {
                    return Error('Missing Identifier element for Receiver element!');
                }
                const receiver_id = receiver_id_element._;


                const contact_info_rec = findValuesHelper(Receiver_element, 'ContactInformation', []);
                if (contact_info_rec.length <= 0) {
                    return Error('Missing ContactInformation element for Receiver element!');
                }
                const ContactInformation_element_receiver = Receiver_element.ContactInformation;


                const doc_identification = findValuesHelper(StandardBusinessDocumentHeader_element, 'DocumentIdentification', []);
                if (doc_identification.length <= 0) {
                    return Error('Missing DocumentIdentification element for StandardBusinessDocumentHeader element!');
                }
                const DocumentIdentification_element =
                    StandardBusinessDocumentHeader_element.DocumentIdentification;


                const bus_scope = findValuesHelper(StandardBusinessDocumentHeader_element, 'BusinessScope', []);
                if (bus_scope.length <= 0) {
                    return Error('Missing BusinessScope element for StandardBusinessDocumentHeader element!');
                }
                const BusinessScope_element =
                    StandardBusinessDocumentHeader_element.BusinessScope;


                sender.sender_id = {};
                sender.sender_id.identifiers = {};
                sender.sender_id.identifiers.sender_id = sender_id;
                sender.sender_id.identifiers.uid = sender_id;
                sender.sender_id.data = ContactInformation_element;
                sender.sender_id.vertex_type = 'SENDER';


                receiver.receiver_id = {};
                receiver.receiver_id.identifiers = {};
                receiver.receiver_id.identifiers.receiver_id = receiver_id;
                receiver.receiver_id.data = ContactInformation_element_receiver;
                receiver.receiver_id.vertex_type = 'RECEIVER';

                // /BUSINESS SCOPE AND DOCUMENT IDENTIFICATION

                document_meta = Object.assign(
                    {},
                    document_meta,
                    { BusinessScope_element, DocumentIdentification_element },
                );


                // ///////////READING Master Data///////////

                const ext = findValuesHelper(EPCISHeader_element, 'extension', []);
                if (ext.length <= 0) {
                    return Error('Missing extension element for EPCISHeader element!');
                }
                const extension_element = EPCISHeader_element.extension;


                const epcis_master = findValuesHelper(extension_element, 'EPCISMasterData', []);
                if (epcis_master.length <= 0) {
                    return Error('Missing EPCISMasterData element for extension element!');
                }
                const EPCISMasterData_element = extension_element.EPCISMasterData;


                const vocabulary_li = findValuesHelper(EPCISMasterData_element, 'VocabularyList', []);
                if (vocabulary_li.length <= 0) {
                    return Error('Missing VocabularyList element for EPCISMasterData element!');
                }
                const VocabularyList_element = EPCISMasterData_element.VocabularyList;


                const vocabulary = findValuesHelper(VocabularyList_element, 'Vocabulary', []);
                if (vocabulary.length <= 0) {
                    return Error('Missing Vocabulary element for VocabularyList element!');
                }
                Vocabulary_elements = VocabularyList_element.Vocabulary;


                if (!(Vocabulary_elements instanceof Array)) {
                    const temp_vocabulary_elements = Vocabulary_elements;
                    Vocabulary_elements = [];
                    Vocabulary_elements.push(temp_vocabulary_elements);
                }


                for (const i in Vocabulary_elements) {
                    vocabulary_element = Vocabulary_elements[i];

                    if (!(vocabulary_element instanceof Array)) {
                        const temp_vocabularyel_elements = vocabulary_element;
                        vocabulary_element = [];
                        vocabulary_element.push(temp_vocabularyel_elements);
                    }

                    for (let j in vocabulary_element) {
                        inside = vocabulary_element[j];
                        let pro;

                        for (j in inside) {
                            pro = inside[j];

                            const typ = findValuesHelper(pro, 'type', []);
                            if (typ.length <= 0) {
                                return Error('Missing type element for element!');
                            }
                            const v_type = pro.type;

                            // ////////BUSINESS_LOCATION/////////////
                            if (v_type === 'urn:epcglobal:epcis:vtype:BusinessLocation') {
                                Bussines_location_elements = pro;

                                const voc_el_list = findValuesHelper(Bussines_location_elements, 'VocabularyElementList', []);
                                if (voc_el_list.length === 0) {
                                    return Error('Missing VocabularyElementList element for element!');
                                }
                                VocabularyElementList_element =
                                    Bussines_location_elements.VocabularyElementList;


                                for (const k in VocabularyElementList_element) {
                                    data_object = {};

                                    const VocabularyElement_element =
                                        VocabularyElementList_element[k];
                                    // console.log(VocabularyElement_element)

                                    for (const x in VocabularyElement_element) {
                                        const v = VocabularyElement_element[x];
                                        // console.log(v)

                                        const loc_id = findValuesHelper(v, 'id', []);
                                        if (loc_id.length <= 0) {
                                            return Error('Missing id element for VocabularyElement element!');
                                        }
                                        const str = v.id;
                                        business_location_id = str.replace('urn:epc:id:sgln:', '');


                                        const attr = findValuesHelper(v, 'attribute', []);
                                        if (attr.length <= 0) {
                                            return Error('Missing attribute element for VocabularyElement element!');
                                        }
                                        const { attribute } = v;

                                        for (const y in attribute) {
                                            const kk = attribute[y];


                                            const att_id = findValuesHelper(kk, 'id', []);
                                            if (att_id.length <= 0) {
                                                return Error('Missing id attribute for element!');
                                            }
                                            const str = kk.id;
                                            attribute_id = str;


                                            data_object[attribute_id] = kk._;
                                        }

                                        var children_elements;
                                        const children_check = findValuesHelper(v, 'children', []);
                                        if (children_check.length === 0) {
                                            return Error('Missing children element for element!');
                                        }
                                        children_elements = v.children;


                                        if (findValuesHelper(children_elements, 'id', []).length === 0) {
                                            return Error('Missing id element in children element for business location!');
                                        }

                                        const children_id = children_elements.id;
                                        var child_id_obj;
                                        var child_location_id;
                                        for (const mn in children_id) {
                                            child_id_obj = (children_id[mn]);

                                            if (!(child_id_obj instanceof Array)) {
                                                const temp_child_id = child_id_obj;
                                                child_id_obj = [];
                                                child_id_obj.push(temp_child_id);
                                            }

                                            for (const r in child_id_obj) {
                                                child_location_id = child_id_obj[r];

                                                business_location_edges.push({
                                                    _key: md5(`child_business_location_${sender_id}_${child_location_id}_${business_location_id}`),
                                                    _from: `ot_vertices/${md5(`business_location_${sender_id}_${child_location_id}`)}`,
                                                    _to: `ot_vertices/${md5(`business_location_${sender_id}_${business_location_id}`)}`,
                                                    edge_type: 'CHILD_BUSINESS_LOCATION',
                                                });

                                                locations[child_location_id] = {};
                                                locations[child_location_id].data = { type: 'child_location' };
                                                locations[child_location_id].identifiers = {};
                                                locations[child_location_id]
                                                    .identifiers
                                                    .bussines_location_id = child_location_id;
                                                locations[child_location_id]
                                                    .identifiers.uid = child_location_id;
                                                locations[child_location_id].vertex_type = 'BUSINESS_LOCATION';
                                                locations[child_location_id]._key = md5(`business_location_${sender_id}_${child_location_id}`);
                                            }
                                        }

                                        if (findValuesHelper(v, 'extension', []).length !== 0) {
                                            const attr = findValuesHelper(v.extension, 'attribute', []);
                                            if (attr.length !== 0) {
                                                let ext_attribute;
                                                ext_attribute = v.extension.attribute;

                                                if (ext_attribute.length === undefined) {
                                                    ext_attribute = [ext_attribute];
                                                }

                                                for (const y in ext_attribute) {
                                                    const kk = ext_attribute[y];


                                                    const att_id = findValuesHelper(kk, 'id', []);
                                                    if (att_id.length <= 0) {
                                                        return Error('Missing id attribute for element!');
                                                    }
                                                    const str = kk.id;
                                                    attribute_id = str;


                                                    attribute_id = attribute_id.replace('urn:ot:location:', '');


                                                    if (attribute_id === 'participantId') {
                                                        owned_by_edges.push({
                                                            _from: `ot_vertices/${md5(`business_location_${sender_id}_${business_location_id}`)}`,
                                                            _to: `ot_vertices/${md5(`participant_${sender_id}_${kk._}`)}`,
                                                            edge_type: 'OWNED_BY',
                                                            _key: md5(`owned_by_${sender_id}_${business_location_id}_${kk._}`),
                                                        });
                                                    }
                                                }
                                            }
                                        }

                                        const new_obj = {};
                                        const sanitized_object_data = sanitize(object_data, new_obj, ['urn:', 'ot:', 'mda:', 'object:']);

                                        locations[business_location_id] = {};
                                        locations[business_location_id].identifiers = {};
                                        locations[business_location_id]
                                            .identifiers
                                            .bussines_location_id = business_location_id;
                                        locations[business_location_id]
                                            .identifiers.uid = business_location_id;
                                        locations[business_location_id]
                                            .data = utilities.copyObject(sanitized_object_data);
                                        locations[business_location_id].vertex_type = 'BUSINESS_LOCATION';
                                        locations[business_location_id]._key = md5(`business_location_${sender_id}_${business_location_id}`);
                                    }
                                }
                            }

                            var Participant_elements;
                            var exten_element;
                            var OTVocabularyElement_element;
                            var participant_id;
                            var attribute_elements;
                            // /////PARTICIPANT///////////
                            if (v_type === 'urn:ot:mda:participant') {
                                Participant_elements = pro;

                                const extension_check = findValuesHelper(Participant_elements, 'extension', []);
                                if (extension_check.length === 0) {
                                    return Error('Missing extension element for Participant element!');
                                }
                                exten_element = Participant_elements.extension;


                                const ot_voc_check = findValuesHelper(exten_element, 'OTVocabularyElement', []);
                                if (ot_voc_check.length === 0) {
                                    return Error('Missing OTVocabularyElement for extension element!');
                                }
                                OTVocabularyElement_element = exten_element.OTVocabularyElement;


                                const participant_id_check = findValuesHelper(OTVocabularyElement_element, 'id', []);
                                if (participant_id_check.length === 0) {
                                    return Error('Missing id for Participant element!');
                                }
                                participant_id = OTVocabularyElement_element.id;


                                const attribute_check = findValuesHelper(OTVocabularyElement_element, 'attribute', []);
                                if (attribute_check.length === 0) {
                                    return Error('Missing attribute for Participant element!');
                                }
                                attribute_elements = OTVocabularyElement_element.attribute;


                                participants_data = {};

                                for (const zx in attribute_elements) {
                                    const attribute_el = attribute_elements[zx];

                                    var value;
                                    const value_check = findValuesHelper(attribute_el, '_', []);
                                    if (value_check.length === 0) {
                                        return Error('Missing value for attribute element!');
                                    }
                                    value = attribute_el._;


                                    var attr_id;
                                    const attr_id_check = findValuesHelper(attribute_el, 'id', []);
                                    if (attr_id_check.length === 0) {
                                        return Error('Missing id element for attribute element!');
                                    }
                                    attr_id = attribute_el.id.replace('urn:ot:mda:participant:', '');


                                    participants_data[attr_id] = value;
                                }

                                participants[participant_id] = {};
                                participants[participant_id].identifiers = {};
                                participants[participant_id]
                                    .identifiers
                                    .participant_id = participant_id;
                                participants[participant_id].identifiers.uid = participant_id;
                                participants[participant_id]
                                    .data = utilities.copyObject(participants_data);
                                participants[participant_id].vertex_type = 'PARTICIPANT';
                                participants[participant_id]._key = md5(`participant_${sender_id}_${participant_id}`);
                            }


                            var Object_elements;
                            // ////OBJECT////////
                            if (v_type === 'urn:ot:mda:object') {
                                Object_elements = pro;

                                var extensio_element;
                                const extensio_check = findValuesHelper(Object_elements, 'extension', []);
                                if (extensio_check.length === 0) {
                                    return Error('Missing extension element for Object element!');
                                }
                                extensio_element = Object_elements.extension;


                                var OTVocabularyEl;
                                const OTVocabularyEl_check = findValuesHelper(extensio_element, 'OTVocabularyElement', []);
                                if (OTVocabularyEl_check.length === 0) {
                                    return Error('Missing OTVocabularyElement element for extension element!');
                                }
                                OTVocabularyEl = extensio_element.OTVocabularyElement;


                                var object_id;
                                const object_id_check = findValuesHelper(OTVocabularyEl, 'id', []);
                                if (object_id_check.length === 0) {
                                    return Error('Missing id element for OTVocabularyElement!');
                                }
                                object_id = OTVocabularyEl.id;


                                var object_attribute_elements;
                                const attribute_el_check = findValuesHelper(OTVocabularyEl, 'attribute', []);
                                if (attribute_el_check.length === 0) {
                                    return Error('Missing attribute element for OTVocabularyElement!');
                                }
                                object_attribute_elements = OTVocabularyEl.attribute;


                                for (const rr in object_attribute_elements) {
                                    var single_attribute;
                                    single_attribute = object_attribute_elements[rr];

                                    var single_attribute_id;
                                    const single_attribute_id_check = findValuesHelper(single_attribute, 'id', []);
                                    if (single_attribute_id_check.length === 0) {
                                        return Error('Missing id element for attribute element!');
                                    }
                                    single_attribute_id = single_attribute.id;


                                    var single_attribute_value;
                                    const single_attribute_value_check = findValuesHelper(single_attribute, '_', []);
                                    if (single_attribute_value_check.length === 0) {
                                        return Error('Missing value element for attribute element!');
                                    }
                                    single_attribute_value = single_attribute._;


                                    object_data[single_attribute_id] = single_attribute_value;
                                    const new_obj = {};
                                    const sanitized_object_data = sanitize(object_data, new_obj, ['urn:', 'ot:', 'mda:', 'object:']);


                                    objects[object_id] = {};
                                    objects[object_id].identifiers = {};
                                    objects[object_id].identifiers.object_id = object_id;
                                    objects[object_id]
                                        .data = utilities.copyObject(sanitized_object_data);
                                    objects[object_id].vertex_type = 'OBJECT';
                                    objects[object_id]._key = md5(`object_${sender_id}_${object_id}`);
                                }
                            }

                            var Batch_elements;
                            // //////BATCH/////////
                            if (v_type === 'urn:ot:mda:batch') {
                                Batch_elements = pro;

                                var batch_extension;
                                const batch_extension_check = findValuesHelper(Batch_elements, 'extension', []);
                                if (batch_extension_check.length === 0) {
                                    return Error('Missing extension element for Batch element!');
                                }
                                batch_extension = Batch_elements.extension;


                                var OTVoc_El_elements;
                                const OTVoc_El_elements_check = findValuesHelper(batch_extension, 'OTVocabularyElement', []);
                                if (OTVoc_El_elements_check.length === 0) {
                                    return Error('Missing OTVocabularyElement element for extension element!');
                                }
                                OTVoc_El_elements = batch_extension.OTVocabularyElement;


                                var ot_vocabulary_element;
                                for (const g in OTVoc_El_elements) {
                                    ot_vocabulary_element = OTVoc_El_elements[g];

                                    var batch_id;
                                    const batch_id_element_check = findValuesHelper(ot_vocabulary_element, 'id', []);
                                    if (batch_id_element_check.length === 0) {
                                        return Error('Missing id element for OTVocabularyElement!');
                                    }
                                    batch_id = ot_vocabulary_element.id;


                                    var batch_attribute_el;
                                    const batch_attribute_el_check = findValuesHelper(ot_vocabulary_element, 'attribute', []);
                                    if (batch_attribute_el_check.length === 0) {
                                        return Error('Missing attribute element for OTVocabularyElement!');
                                    }
                                    batch_attribute_el = ot_vocabulary_element.attribute;


                                    var single;
                                    for (const one in batch_attribute_el) {
                                        single = batch_attribute_el[one];

                                        var batch_attribute_id;
                                        const batch_attribute_id_check = findValuesHelper(single, 'id', []);
                                        if (batch_attribute_id_check.length === 0) {
                                            return Error('Missing id element for attribute element!');
                                        }
                                        batch_attribute_id = single.id;


                                        var batch_attribute_value;
                                        const batch_attribute_value_check = findValuesHelper(single, '_', []);
                                        if (batch_attribute_value_check.length === 0) {
                                            return Error('Missing value element for attribute element!');
                                        }
                                        batch_attribute_value = single._;


                                        batch_data[batch_attribute_id] = batch_attribute_value;

                                        const new_obj = {};
                                        const sanitized_batch_data = sanitize(batch_data, new_obj, ['urn:', 'ot:', 'mda:', 'batch:']);

                                        if (sanitized_batch_data.objectid !== undefined) {
                                            instance_of_edges.push({
                                                _from: `ot_vertices/${md5(`batch_${sender_id}_${batch_id}`)}`,
                                                _to: `ot_vertices/${md5(`object_${sender_id}_${object_id}`)}`,
                                                _key: md5(`object_${sender_id}__${batch_id}${object_id}`),
                                                edge_type: 'INSTANCE_OF',
                                            });
                                        }


                                        batches[batch_id] = {};
                                        batches[batch_id].identifiers = {};
                                        batches[batch_id].identifiers.batch_id = batch_id;
                                        batches[batch_id].identifiers.uid = batch_id;
                                        batches[batch_id]
                                            .data = utilities.copyObject(sanitized_batch_data);
                                        batches[batch_id].vertex_type = 'BATCH';
                                        batches[batch_id]._key = md5(`batch_${sender_id}_${batch_id}`);
                                    }
                                }
                            }
                        }
                    }
                }

                // READING EPCIS Document Body

                if (findValuesHelper(EPCISDocument_element, 'EPCISBody', []).length !== 0) {
                    const body_element = EPCISDocument_element.EPCISBody;

                    if (findValuesHelper(result, 'EventList', []).length === 0) {
                        return Error('Missing EventList element');
                    }

                    var event_list_element = body_element.EventList;


                    for (var event_type in event_list_element) {
                        let events = [];

                        if (event_list_element[event_type].length === undefined) {
                            events = [event_list_element[event_type]];
                        } else {
                            events = event_list_element[event_type];
                        }


                        for (const i in events) {
                            let event_batches = [];

                            const event = events[i];

                            if (event_type === 'ObjectEvent') {
                                // eventTime
                                if (findValuesHelper(event, 'eventTime', []).length === 0) {
                                    return Error('Missing eventTime element for event!');
                                }

                                const event_time = event.eventTime;

                                if (typeof event_time !== 'string') {
                                    return Error('Multiple eventTime elements found!');
                                }

                                // eventTimeZoneOffset
                                if (findValuesHelper(event, 'eventTimeZoneOffset', []).length === 0) {
                                    return Error('Missing event_time_zone_offset element for event!');
                                }

                                const event_time_zone_offset = event.eventTimeZoneOffset;

                                if (typeof event_time_zone_offset !== 'string') {
                                    return Error('Multiple event_time_zone_offset elements found!');
                                }

                                let event_id = `${sender_id}:${event_time}Z${event_time_zone_offset}`;

                                // baseExtension + eventID
                                if (findValuesHelper(event, 'baseExtension', []).length > 0) {
                                    const baseExtension_element = event.baseExtension;


                                    if (findValuesHelper(baseExtension_element, 'eventID', []).length === 0) {
                                        return Error('Missing eventID in baseExtension!');
                                    }

                                    event_id = baseExtension_element.eventID;
                                }

                                // epcList
                                if (findValuesHelper(event, 'epcList', []).length === 0) {
                                    return Error('Missing epcList element for event!');
                                }

                                const { epcList } = event;

                                if (findValuesHelper(epcList, 'epc', []).length === 0) {
                                    return Error('Missing epc element in epcList for event!');
                                }

                                const { epc } = epcList;

                                if (typeof epc === 'string') {
                                    event_batches = [epc];
                                } else {
                                    event_batches = epc;
                                }

                                // readPoint
                                let read_point;
                                if (findValuesHelper(event, 'readPoint', []).length !== 0) {
                                    const read_point_element = event.readPoint;

                                    if (findValuesHelper(read_point_element, 'id', []).length === 0) {
                                        return Error('Missing id for readPoint!');
                                    }

                                    read_point = read_point_element.id;
                                }


                                // bizLocation
                                let biz_location;
                                if (findValuesHelper(event, 'bizLocation', []).length !== 0) {
                                    const biz_location_element = event.bizLocation;

                                    if (findValuesHelper(biz_location_element, 'id', []).length === 0) {
                                        return Error('Missing id for bizLocation!');
                                    }

                                    biz_location = biz_location_element.id;
                                }

                                const object_event = {
                                    identifiers: {
                                        event_id,
                                        uid: event_id,
                                    },
                                    data: event,
                                    vertex_type: 'EVENT',
                                    _key: md5(`event_${sender_id}_${event_id}`),
                                };

                                object_events[event_id] = utilities.copyObject(object_event);

                                for (const bi in event_batches) {
                                    event_batch_edges.push({
                                        _key: md5(`event_batch_${sender_id}_${event_id}_${event_batches[bi]}`),
                                        _from: `ot_vertices/${md5(`batch_${sender_id}_${event_batches[bi]}`)}`,
                                        _to: `ot_vertices/${md5(`event_${sender_id}_${event_id}`)}`,
                                        edge_type: 'EVENT_BATCHES',
                                    });
                                }

                                if (read_point !== undefined) {
                                    read_point_edges.push({
                                        _key: md5(`read_point_${sender_id}_${event_id}_${read_point}`),
                                        _from: `ot_vertices/${md5(`event_${sender_id}_${event_id}`)}`,
                                        _to: `ot_vertices/${md5(`business_location_${sender_id}_${read_point}`)}`,
                                        edge_type: 'READ_POINT',
                                    });
                                }

                                if (biz_location !== undefined) {
                                    at_edges.push({
                                        _key: md5(`at_${sender_id}_${event_id}_${biz_location}`),
                                        _from: `ot_vertices/${md5(`event_${sender_id}_${event_id}`)}`,
                                        _to: `ot_vertices/${md5(`business_location_${sender_id}_${biz_location}`)}`,
                                        edge_type: 'AT',
                                    });
                                }
                            } else if (event_type === 'AggregationEvent') {
                                // eventTime
                                if (findValuesHelper(event, 'eventTime', []).length === 0) {
                                    return Error('Missing eventTime element for event!');
                                }

                                const event_time = event.eventTime;

                                if (typeof event_time !== 'string') {
                                    return Error('Multiple eventTime elements found!');
                                }

                                // eventTimeZoneOffset
                                if (findValuesHelper(event, 'eventTimeZoneOffset', []).length === 0) {
                                    return Error('Missing event_time_zone_offset element for event!');
                                }

                                const event_time_zone_offset = event.eventTimeZoneOffset;

                                if (typeof event_time_zone_offset !== 'string') {
                                    return Error('Multiple event_time_zone_offset elements found!');
                                }

                                let event_id = `${sender_id}:${event_time}Z${event_time_zone_offset}`;

                                // baseExtension + eventID
                                if (findValuesHelper(event, 'baseExtension', []).length > 0) {
                                    const baseExtension_element = event.baseExtension;


                                    if (findValuesHelper(baseExtension_element, 'eventID', []).length === 0) {
                                        return Error('Missing eventID in baseExtension!');
                                    }

                                    event_id = baseExtension_element.eventID;
                                }

                                // parentID
                                if (findValuesHelper(event, 'parentID', []).length === 0) {
                                    return Error('Missing parentID element for Aggregation event!');
                                }

                                const parent_id = event.parentID;

                                // childEPCs
                                let child_epcs = [];

                                if (findValuesHelper(event, 'childEPCs', []).length === 0) {
                                    return Error('Missing childEPCs element for event!');
                                }

                                const epcList = event.childEPCs;

                                if (findValuesHelper(epcList, 'epc', []).length === 0) {
                                    return Error('Missing epc element in epcList for event!');
                                }

                                const { epc } = epcList;

                                if (typeof epc === 'string') {
                                    child_epcs = [epc];
                                } else {
                                    child_epcs = epc;
                                }

                                // readPoint
                                let read_point;
                                if (findValuesHelper(event, 'readPoint', []).length !== 0) {
                                    const read_point_element = event.readPoint;

                                    if (findValuesHelper(read_point_element, 'id', []).length === 0) {
                                        return Error('Missing id for readPoint!');
                                    }

                                    read_point = read_point_element.id;
                                }

                                // bizLocation
                                let biz_location;
                                if (findValuesHelper(event, 'bizLocation', []).length !== 0) {
                                    const biz_location_element = event.bizLocation;

                                    if (findValuesHelper(biz_location_element, 'id', []).length === 0) {
                                        return Error('Missing id for bizLocation!');
                                    }

                                    biz_location = biz_location_element.id;
                                }

                                const aggregation_event = {
                                    identifiers: {
                                        event_id,
                                        uid: event_id,
                                    },
                                    data: event,
                                    vertex_type: 'EVENT',
                                    _key: md5(`event_${sender_id}_${event_id}`),
                                };


                                aggregation_events[event_id] =
                                    utilities.copyObject(aggregation_event);

                                for (const bi in child_epcs) {
                                    child_batches_edges.push({
                                        _key: md5(`child_batch_${sender_id}_${event_id}_${child_epcs[bi]}`),
                                        _from: `ot_vertices/${md5(`event_${sender_id}_${event_id}`)}`,
                                        _to: `ot_vertices/${md5(`batch_${sender_id}_${child_epcs[bi]}`)}`,
                                        edge_type: 'CHILD_BATCH',
                                    });
                                }

                                if (read_point !== undefined) {
                                    read_point_edges.push({
                                        _key: md5(`read_point_${sender_id}_${event_id}_${read_point}`),
                                        _from: `ot_vertices/${md5(`event_${sender}_${event_id}`)}`,
                                        _to: `ot_vertices/${md5(`business_location_${sender_id}_${read_point}`)}`,
                                        edge_type: 'READ_POINT',

                                    });
                                }

                                if (biz_location !== undefined) {
                                    at_edges.push({
                                        _key: md5(`at_${sender_id}_${event_id}_${biz_location}`),
                                        _from: `ot_vertices/${md5(`event_${sender_id}_${event_id}`)}`,
                                        _to: `ot_vertices/${md5(`business_location_${sender_id}_${biz_location}`)}`,
                                        edge_type: 'AT',
                                    });
                                }

                                parent_batches_edges.push({
                                    _key: md5(`at_${sender_id}_${event_id}_${biz_location}`),
                                    _from: `ot_vertices/${md5(`batch_${sender_id}_${parent_id}`)}`,
                                    _to: `ot_vertices/${md5(`event_${sender_id}_${event_id}`)}`,
                                    edge_type: 'PARENT_BATCH',
                                });
                            } else if (event_type === 'extension') {
                                const extension_events = event;

                                for (var ext_event_type in extension_events) {
                                    let ext_events = [];

                                    if (extension_events[ext_event_type].length === undefined) {
                                        ext_events = [extension_events[ext_event_type]];
                                    } else {
                                        ext_events = event_list_element[ext_event_type];
                                    }


                                    for (const i in ext_events) {
                                        const ext_event = ext_events[i];

                                        if (ext_event_type === 'TransformationEvent') {
                                            // eventTime
                                            if (findValuesHelper(ext_event, 'transformationID', []).length === 0) {
                                                return Error('Missing transformationID element for event!');
                                            }

                                            const ext_event_id = ext_event.transformationID;

                                            // inputEPCList
                                            let input_epcs = [];

                                            if (findValuesHelper(ext_event, 'inputEPCList', []).length === 0) {
                                                return Error('Missing inputEPCList element for event!');
                                            }

                                            const epcList = ext_event.inputEPCList;

                                            if (findValuesHelper(epcList, 'epc', []).length === 0) {
                                                return Error('Missing epc element in epcList for event!');
                                            }

                                            const { epc } = epcList;

                                            if (typeof epc === 'string') {
                                                input_epcs = [epc];
                                            } else {
                                                input_epcs = epc;
                                            }

                                            // outputEPCList
                                            let output_epcs = [];

                                            if (findValuesHelper(ext_event, 'outputEPCList', []).length !== 0) {
                                                const epcList = ext_event.outputEPCList;

                                                if (findValuesHelper(epcList, 'epc', []).length === 0) {
                                                    return Error('Missing epc element in epcList for event!');
                                                }

                                                const { epc } = epcList;

                                                if (typeof epc === 'string') {
                                                    output_epcs = [epc];
                                                } else {
                                                    output_epcs = epc;
                                                }
                                            }


                                            // readPoint
                                            let read_point;
                                            if (findValuesHelper(ext_event, 'readPoint', []).length !== 0) {
                                                const read_point_element = ext_event.readPoint;

                                                if (findValuesHelper(read_point_element, 'id', []).length === 0) {
                                                    return Error('Missing id for readPoint!');
                                                }

                                                read_point = read_point_element.id;
                                            }

                                            const transformation_event = {
                                                identifiers: {
                                                    event_id: ext_event_id,
                                                    uid: ext_event_id,
                                                },
                                                data: ext_event,
                                                vertex_type: 'EVENT',
                                                _key: md5(`event_${sender_id}_${ext_event_id}`),
                                            };

                                            transformation_events[ext_event_id] =
                                                utilities.copyObject(transformation_event);

                                            // bizLocation
                                            let biz_location;
                                            if (findValuesHelper(
                                                ext_event,
                                                'bizLocation',
                                                [],
                                            ).length !== 0) {
                                                const biz_location_element =
                                                    ext_event.bizLocation;

                                                if (findValuesHelper(biz_location_element, 'id', []).length === 0) {
                                                    return Error('Missing id for bizLocation!');
                                                }

                                                biz_location = biz_location_element.id;
                                            }


                                            for (const bi in input_epcs) {
                                                input_batches_edges.push({
                                                    _key: md5(`child_batch_${sender_id}_${ext_event_id}_${input_epcs[bi]}`),
                                                    _from: `ot_vertices/${md5(`event_${sender_id}_${ext_event_id}`)}`,
                                                    _to: `ot_vertices/${md5(`batch_${sender_id}_${input_epcs[bi]}`)}`,
                                                    edge_type: 'INPUT_BATCH',
                                                });
                                            }

                                            for (const bi in output_epcs) {
                                                output_batches_edges.push({
                                                    _key: md5(`child_batch_${sender_id}_${ext_event_id}_${output_epcs[bi]}`),
                                                    _from: `ot_vertices/${md5(`batch_${sender_id}_${output_epcs[bi]}`)}`,
                                                    _to: `ot_vertices/${md5(`event_${sender_id}_${ext_event_id}`)}`,
                                                    edge_type: 'OUTPUT_BATCH',
                                                });
                                            }

                                            if (read_point !== undefined) {
                                                read_point_edges.push({
                                                    _key: md5(`read_point_${sender_id}_${ext_event_id}_${read_point}`),
                                                    _from: `ot_vertices/${md5(`event_${sender_id}_${ext_event_id}`)}`,
                                                    _to: `ot_vertices/${md5(`business_location_${sender_id}_${read_point}`)}`,
                                                    edge_type: 'READ_POINT',

                                                });
                                            }

                                            if (biz_location !== undefined) {
                                                at_edges.push({
                                                    _key: md5(`at_${sender_id}_${ext_event_id}_${biz_location}`),
                                                    _from: `ot_vertices/${md5(`event_${sender_id}_${ext_event_id}`)}`,
                                                    _to: `ot_vertices/${md5(`business_location_${sender_id}_${biz_location}`)}`,
                                                    edge_type: 'AT',
                                                });
                                            }
                                        } else {
                                            return Error(`Unsupported event type: ${event_type}`);
                                        }
                                    }
                                }
                            } else {
                                return Error(`Unsupported event type: ${event_type}`);
                            }
                        }
                    }

                    var vertices_list = [];
                    var edges_list = [];
                    var import_id = Date.now();

                    var temp_participants = [];
                    for (const i in participants) {
                        temp_participants.push(participants[i]);
                        vertices_list.push(participants[i]);
                    }

                    try {
                        deasync(db.createCollection('ot_vertices'));
                        deasync(db.createEdgeCollection('ot_edges'));
                    } catch (err) {
                        console.log(err);
                    }

                    async.each(temp_participants, (participant, next) => {
                        db.addDocument('ot_vertices', participant).then(() => {
                            updateImportNumber('ot_vertices', participant, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing participants complete');
                    });

                    var temp_objects = [];
                    for (const i in objects) {
                        temp_objects.push(objects[i]);
                        vertices_list.push(objects[i]);
                    }

                    async.each(temp_objects, (object, next) => {
                        db.addDocument('ot_vertices', object).then(() => {
                            updateImportNumber('ot_vertices', object, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing objects complete');
                    });

                    var temp_locations = [];
                    for (const i in locations) {
                        temp_locations.push(locations[i]);
                        vertices_list.push(locations[i]);
                    }

                    async.each(temp_locations, (location, next) => {
                        db.addDocument('ot_vertices', location).then(() => {
                            updateImportNumber('ot_vertices', location, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing business locations complete');
                    });

                    var temp_batches = [];
                    for (const i in batches) {
                        temp_batches.push(batches[i]);
                        vertices_list.push(batches[i]);
                    }

                    async.each(temp_batches, (batch, next) => {
                        db.addDocument('ot_vertices', batch).then(() => {
                            updateImportNumber('ot_vertices', batch, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing batches complete');
                    });


                    var temp_object_events = [];
                    for (const i in object_events) {
                        temp_object_events.push(object_events[i]);
                        vertices_list.push(object_events[i]);
                    }

                    async.each(temp_object_events, (event, next) => {
                        db.addDocument('ot_vertices', event).then(() => {
                            updateImportNumber('ot_vertices', event, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing object events complete');
                    });

                    var temp_aggregation_events = [];
                    for (const i in aggregation_events) {
                        temp_aggregation_events.push(aggregation_events[i]);
                        vertices_list.push(aggregation_events[i]);
                    }

                    async.each(temp_aggregation_events, (event, next) => {
                        db.addDocument('ot_vertices', event).then(() => {
                            updateImportNumber('ot_vertices', event, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing aggregation events complete');
                    });

                    var temp_transformation_events = [];
                    for (const i in transformation_events) {
                        temp_transformation_events.push(transformation_events[i]);
                        vertices_list.push(transformation_events[i]);
                    }

                    async.each(temp_transformation_events, (event, next) => {
                        db.addDocument('ot_vertices', event).then(() => {
                            updateImportNumber('ot_vertices', event, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing transformation events complete');
                    });


                    for (const i in instance_of_edges) {
                        edges_list.push(instance_of_edges[i]);
                    }

                    async.each(instance_of_edges, (edge, next) => {
                        db.addDocument('ot_edges', edge).then(() => {
                            updateImportNumber('ot_edges', edge, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing instance_of edges complete');
                    });

                    for (const i in owned_by_edges) {
                        edges_list.push(owned_by_edges[i]);
                    }

                    async.each(owned_by_edges, (edge, next) => {
                        db.addDocument('ot_edges', edge).then(() => {
                            updateImportNumber('ot_edges', edge, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing owned_by edges complete');
                    });

                    for (const i in at_edges) {
                        edges_list.push(at_edges[i]);
                    }

                    async.each(at_edges, (edge, next) => {
                        db.addDocument('ot_edges', edge).then(() => {
                            updateImportNumber('ot_edges', edge, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing at_edges complete');
                    });


                    for (const i in read_point_edges) {
                        edges_list.push(read_point_edges[i]);
                    }

                    async.each(read_point_edges, (edge, next) => {
                        db.addDocument('ot_edges', edge).then(() => {
                            updateImportNumber('ot_edges', edge, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing read_point edges  complete');
                    });

                    for (const i in event_batch_edges) {
                        edges_list.push(event_batch_edges[i]);
                    }

                    async.each(event_batch_edges, (edge, next) => {
                        db.addDocument('ot_edges', edge).then(() => {
                            updateImportNumber('ot_edges', edge, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing event_batch edges  complete');
                    });

                    for (const i in parent_batches_edges) {
                        edges_list.push(parent_batches_edges[i]);
                    }

                    async.each(parent_batches_edges, (edge, next) => {
                        db.addDocument('ot_edges', edge).then(() => {
                            updateImportNumber('ot_edges', edge, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing parent_batches edges  complete');
                    });

                    for (const i in child_batches_edges) {
                        edges_list.push(child_batches_edges[i]);
                    }

                    async.each(child_batches_edges, (edge, next) => {
                        db.addDocument('ot_edges', edge).then(() => {
                            updateImportNumber('ot_edges', edge, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing child_batches edges  complete');
                    });

                    for (const i in input_batches_edges) {
                        edges_list.push(input_batches_edges[i]);
                    }

                    async.each(input_batches_edges, (edge, next) => {
                        db.addDocument('ot_edges', edge).then(() => {
                            updateImportNumber('ot_edges', edge, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing input_batches edges  complete');
                    });

                    for (const i in output_batches_edges) {
                        edges_list.push(output_batches_edges[i]);
                    }

                    async.each(output_batches_edges, (edge, next) => {
                        db.addDocument('ot_edges', edge).then(() => {
                            updateImportNumber('ot_edges', edge, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing output_batches edges  complete');
                    });

                    for (const i in business_location_edges) {
                        edges_list.push(business_location_edges[i]);
                    }

                    async.each(business_location_edges, (edge, next) => {
                        db.addDocument('ot_edges', edge).then(() => {
                            updateImportNumber('ot_edges', edge, import_id).then(() => {
                                next();
                            });
                        });
                    }, () => {
                        console.log('Writing business_location edges  complete');
                    });


                    utilities.executeCallback(
                        callback,
                        { vertices: vertices_list, edges: edges_list, import_id },
                    );
                }
            },
        );
    },
});
