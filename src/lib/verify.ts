import { Event, getEventHash, validateEvent } from "nostr-tools";

import { eventVerifyTypes } from "../interfaces/verify.js";
import { logger } from "./logger.js";

const verifyEvent = async (event:Event): Promise<eventVerifyTypes> => {
    logger.debug("Verifying event", event);
	try {
		const IsEventHashValid = getEventHash(event);
		if (IsEventHashValid != event.id) {
            logger.debug("Event hash is not valid");
			return eventVerifyTypes.hashError;
		}
		const IsEventValid = validateEvent(event);
		if (!IsEventValid) {
            logger.debug("Event signature is not valid");
			return eventVerifyTypes.signatureError;
		}
	} catch (error) {
        logger.debug("Malformed event");
        return eventVerifyTypes.malformed;
	}
    logger.debug("Valid event");
    return eventVerifyTypes.valid;
};

const verifyEventTimestamp = async (event:Event): Promise<boolean> => {

	logger.debug("Verifying event timestamp", event);
	const diff =  (Math.floor(Date.now() / 1000) - event.created_at);
	logger.debug("Event is", diff, "seconds old");
	if (diff > 60){ //60 seconds max event age
		return false;
	}
	return true;
}

export { verifyEvent, verifyEventTimestamp };
