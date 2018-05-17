const validator = require('validator');

class GS1Helper {
    static sanitize(old_obj, new_obj, patterns) {
        if (typeof old_obj !== 'object') { return old_obj; }

        for (const key in old_obj) {
            let new_key = key;
            for (const i in patterns) {
                new_key = new_key.replace(patterns[i], '');
            }
            new_obj[new_key] = GS1Helper.sanitize(old_obj[key], {}, patterns);
        }
        return new_obj;
    }

    static dateTimeValidation(date) {
        const result = validator.isISO8601(date);
        return !!result;
    }

    static arrayze(value) {
        if (value) {
            return [].concat(value);
        }
        return [];
    }

    static getEventId(senderId, event) {
        if (GS1Helper.arrayze(event.eventTime).length === 0) {
            throw Error('Missing eventTime element for event!');
        }
        const event_time = event.eventTime;

        const event_time_validation = GS1Helper.dateTimeValidation(event_time);
        if (!event_time_validation) {
            throw Error('Invalid date and time format for event time!');
        }
        if (typeof event_time !== 'string') {
            throw Error('Multiple eventTime elements found!');
        }
        if (GS1Helper.arrayze(event.eventTimeZoneOffset).length === 0) {
            throw Error('Missing event_time_zone_offset element for event!');
        }

        const event_time_zone_offset = event.eventTimeZoneOffset;
        if (typeof event_time_zone_offset !== 'string') {
            throw Error('Multiple event_time_zone_offset elements found!');
        }

        let eventId = `${senderId}:${event_time}Z${event_time_zone_offset}`;
        if (GS1Helper.arrayze(event.baseExtension).length > 0) {
            const baseExtension_element = event.baseExtension;

            if (GS1Helper.arrayze(baseExtension_element.eventID).length === 0) {
                throw Error('Missing eventID in baseExtension!');
            }
            eventId = baseExtension_element.eventID;
        }
        return eventId;
    }
}

module.exports = GS1Helper;
