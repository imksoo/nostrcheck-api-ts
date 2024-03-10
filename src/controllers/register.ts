import { Request, Response } from "express";
import { Event, getEventHash, nip19, validateEvent } from "nostr-tools";
import validator from "validator";

import { connect } from "../lib/database.js";
import { logger } from "../lib/logger.js";
import { RegisterResultMessage } from "../interfaces/register.js";
import { QueryAvailiableDomains } from "../lib/domains.js";
import app from "../app.js";
import { getClientIp } from "../lib/server.js";
import { parseAuthHeader } from "../lib/authorization.js";
import { isModuleEnabled } from "../lib/config.js";

const registernewpubkey = async (req: Request, res: Response): Promise<Response> => {

	// Check if current module is enabled
	if (!isModuleEnabled("register", app)) {
        logger.warn("Attempt to access a non-active module:","register","|","IP:", getClientIp(req));
		return res.status(400).send({"status": "error", "message": "Module is not enabled"});
	}

	logger.info("POST /api/v1/register", "|", getClientIp(req));

    // Check if authorization header is valid
	const EventHeader = await parseAuthHeader(req, "registernewpubkey", true);
	if (EventHeader.status !== "success") {return res.status(401).send({"status": EventHeader.status, "message" : EventHeader.message});}

	//Check all necessary fields
	if (
		req.body.id == null ||
		req.body.pubkey == null ||
		req.body.created_at == null ||
		req.body.kind == null ||
		req.body.tags == null ||
		req.body.content == null ||
		req.body.sig == null
	) {
		logger.warn("RES -> 400 Bad request - malformed JSON");
		const result: RegisterResultMessage = {
			username: "",
			pubkey: "",
			domain: "",
			status: "error",
			message: "Malformed JSON",
		};

		return res.status(400).send(result);
	}

	//Check if username is null (tag or tag value)
	try {
		if (
			req.body.tags[0][0] != "username" ||
			req.body.tags[0][1] == null ||
			req.body.tags[0][1] == undefined
		) {
			logger.warn(
				"RES -> 400 Bad request - malformed or non-existent username tag",
				"|",
				req.headers["x-forwarded-for"] || getClientIp(req)
			);
			const result: RegisterResultMessage = {
				username: "",
				pubkey: "",
				domain: "",
				status: "error",
				message: "Malformed or non-existent username tag",
			};

			return res.status(400).send(result);
		}
	} catch (error) {
		logger.warn(
			"RES -> 400 Bad request - malformed or non-existent username tag",
			"|",
			getClientIp(req)
		);
		const result: RegisterResultMessage = {
			username: "",
			pubkey: "",
			domain: "",
			status: "error",
			message: "Malformed or non-existent username tag",
		};

		return res.status(400).send(result);
	}

	//Check if domain is null (tag or tag value)
	try {
		if (
			req.body.tags[1][0] != "domain" ||
			req.body.tags[1][1] == null ||
			req.body.tags[1][1] == undefined
		) {
			logger.warn(
				"RES -> 400 Bad request - malformed or non-existent domain tag",
				"|",
				req.headers["x-forwarded-for"] || getClientIp(req)
			);
			const result: RegisterResultMessage = {
				username: "",
				pubkey: "",
				domain: "",
				status: "error",
				message: "Malformed or non-existent domain tag",
			};

			return res.status(400).send(result);
		}
	} catch (error) {
		logger.warn(
			"RES -> 400 Bad request - malformed or non-existent domain tag",
			"|",
			getClientIp(req)
		);
		const result: RegisterResultMessage = {
			username: "",
			pubkey: "",
			domain: "",
			status: "error",
			message: "Malformed or non-existent domain tag",
		};

		return res.status(400).send(result);
	}

	//Check if domain is valid
	const AcceptedDomains = await QueryAvailiableDomains();
	let IsValidDomain = JSON.stringify(AcceptedDomains).indexOf(req.body.tags[1][1]) > -1;
	if (app.get('env') === 'development') {
		logger.warn(
			"DEVMODE: Allowing registers to 'localhost' domain", "|", getClientIp(req));
			IsValidDomain = true;
	}

	if (!IsValidDomain) {
		logger.warn("RES -> 406 Bad request - domain not accepted", "|", getClientIp(req));
		const result: RegisterResultMessage = {
			username: "",
			pubkey: "",
			domain: "",
			status: "error",
			message: "Domain not accepted",
		};

		return res.status(406).send(result);
	}

	//Create event object
	const event: Event = {
		kind: req.body.kind,
		created_at: req.body.created_at,
		tags: req.body.tags,
		content: req.body.content,
		pubkey: req.body.pubkey,
		id: req.body.id,
		sig: req.body.sig,
	};

	// Check if event is valid
	try {
		const IsEventHashValid = getEventHash(event);
		if (IsEventHashValid != event.id) {
			logger.warn(
				`RES -> 400 Bad request - Event hash is invalid: ${IsEventHashValid} != ${event.id}`,
				"|",
				getClientIp(req)
			);

			const result: RegisterResultMessage = {
				username: "",
				pubkey: "",
				domain: "",
				status: "error",
				message: "Event hash is not valid",
			};

			return res.status(400).send(result);
		}

		const IsEventValid = validateEvent(event);
		if (!IsEventValid) {
			logger.warn(
				`RES -> 400 Bad request - Event signature is invalid: ${IsEventValid}`,
				"|",
				getClientIp(req)
			);

			const result: RegisterResultMessage = {
				username: "",
				pubkey: "",
				domain: "",
				status: "error",
				message: "Event signature is not valid",
			};

			return res.status(400).send(result);
		}
	} catch (error) {
		logger.warn(`RES -> 400 Bad request - ${error}`, "|", getClientIp(req));
		const result: RegisterResultMessage = {
			username: "",
			pubkey: "",
			domain: "",
			status: "error",
			message: "Malformed event",
		};

		return res.status(400).send(result);
	}

	//Check if username is valid
	const IsValidUsernameCharacters = validator.default.matches(req.body.tags[0][1], /^[a-zA-Z0-9]+$/);
	const IsValidUsernamelenght = validator.default.isLength(req.body.tags[0][1], { min: 3, max: 50 });

	if (!IsValidUsernameCharacters || !IsValidUsernamelenght) {
		logger.warn("RES -> 422 Bad request - Username not allowed", "|", getClientIp(req));
		const result: RegisterResultMessage = {
			username: req.body.tags[0][1],
			pubkey: "",
			domain: req.body.tags[1][1],
			status: "error",
			message: "Username not allowed",
		};

		return res.status(422).send(result);
	}

	const username = req.body.tags[0][1];
	const hex = event.pubkey;
	const pubkey = nip19.npubEncode(hex);
	const domain = req.body.tags[1][1];
	const createdate = new Date(+req.body.created_at * 1000)
		.toISOString()
		.slice(0, 19)
		.replace("T", " ");

	//Check if username alredy exist
	const conn = await connect("Registernewpubkey");
	const [dbResult] = await conn.execute(
		"SELECT * FROM registered where (username = ? and domain = ?) OR (hex = ? and domain = ?)",
		[username, domain, hex, domain]
	);
	const rowstemp = JSON.parse(JSON.stringify(dbResult));

	if (rowstemp[0] != undefined) {
		logger.warn("RES ->", username, "|", "Username or pubkey alredy registered");
		conn.end();

		const result: RegisterResultMessage = {
			username: req.body.tags[0][1],
			pubkey: "",
			domain: req.body.tags[1][1],
			status: "error",
			message: "Username or pubkey alredy registered",
		};

		return res.status(406).send(result);
	}

	//Insert user into database
	const [dbInsert] = await conn.execute(
		"INSERT INTO registered (id, pubkey, hex, username, password, domain, active, date, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		[null, pubkey, hex, username, "", domain, 1, createdate, ""]
	);
	if (!dbInsert) {
		logger.warn("RES ->", username, "|", "Error inserting user into database");
		conn.end();
		const result: RegisterResultMessage = {
			username: req.body.tags[0][1],
			pubkey: "",
			domain: req.body.tags[1][1],
			status: "error",
			message: "Username alredy registered",
		};
		res.status(406).send(result);
	}

	//Send response, user registered, close connection
	conn.end();

	logger.info("RES ->", username, "|", hex, "|", domain, "|", "Registered");
	const result: RegisterResultMessage = {
		username: req.body.tags[0][1],
		pubkey: event.pubkey,
		domain: req.body.tags[1][1],
		status: "success",
		message: "New user registered successfully",
	};

	return res.status(200).send({result, "authkey": EventHeader.authkey});

};

export { registernewpubkey };