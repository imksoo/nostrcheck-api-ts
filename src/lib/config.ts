import config from "config";
import fs from "fs";
import { exit } from "process";
import path from "path";

const defaultPath : string = "./config/default.json";
const localPath : string = "./config/local.json";

import { Module, Modules, necessaryKeys } from "../interfaces/config.js";
import { createkeyPair, getPubkeyFromSecret } from "./nostr/core.js";
import app from "../app.js";
import { Application } from "express";
import { dbMultiSelect } from "./database.js";
import { mediafilesTableFields } from "../interfaces/database.js";

const prepareAppFolders = async() =>{

	// tempPath checks
	const tempPath : string = config.get("media.tempPath");
	if(!tempPath){
		console.error("TempPath is not defined in config file.");
		exit(1);
	}

	if (!fs.existsSync(tempPath)){
		fs.mkdirSync(tempPath);
	}

	fs.readdir(tempPath, (err, files) => {
		if (err) {
			console.error(err);
            exit(1);
		}

		//Delete all files in temp folder
		for (const file of files) {
			fs.unlink(tempPath + file, (err) => {
				if (err) {
                    console.error(err);
                    exit(1);
				}
			});
		}
	});

	// mediaPath checks
	const mediaPath : string = config.get("media.mediaPath");
	if (!mediaPath){
		console.error("MediaPath is not defined in config file.");
		exit(1);
	}
	if (!fs.existsSync(mediaPath)){
		fs.mkdirSync(mediaPath);
	}


	let folderMigrationData = await dbMultiSelect("SELECT DISTINCT registered.username, registered.hex FROM registered",['username', 'hex'], ['1=1'], mediafilesTableFields, false);
	if (folderMigrationData == undefined || folderMigrationData == null || folderMigrationData.length == 0){
		console.debug("No Data to migrate.");
		return;
	}

	const cantRename : string[] = [];
	try {
		folderMigrationData.forEach((item) => {
		const [oldName, newName] = item.split(',');

		const oldPath = path.join(mediaPath, oldName);
		const newPath = path.join(mediaPath, newName);

		if (fs.existsSync(oldPath)) {
			console.debug(`Renaming folder: ${oldPath} to ${newPath}`);
			if (fs.existsSync(newPath)) {
				console.warn(`Folder with the name ${newName} already exists. Skipping...`);
				cantRename.push(oldName + " -> " + newName);
			} else {
				console.debug(`Renaming folder: ${oldPath} to ${newPath}`);
				fs.renameSync(oldPath, newPath);
			}
		}
		});

		if (cantRename.length > 0){
			cantRename.forEach(element => {
				console.warn("Cant rename folder: ", element);
			});
			console.warn("WARNING", cantRename.length,"- Folders not migrated to new version. Server will shut down to prevent data loss.");
			exit(1);
		}


	} catch (err) {
		console.error("Error renaming folders: ", err);
		process.exit(1);
	}

}



async function prepareAPPConfig(): Promise<boolean>{

	if (fs.existsSync(localPath)){
		await syncDefaultConfigValues(defaultPath,localPath);
		await checkConfigNecessaryKeys();
		return true;
	}else{
		fs.copyFile(defaultPath, localPath, function (err) {
			if (err) {
				console.error("An error occured while writing config JSON File.", err);
				exit(1);
			}
		
			console.info("Creating local config file: " + localPath)
			console.warn("Please edit config file and then restart the app.")
			exit(1);
		});
	}

	return false;

}

const checkConfigNecessaryKeys = async () : Promise<void> => {

	let missingFields = [];
	for (const key of necessaryKeys){
		let value = config.get(key);
		if (value === undefined || value === "") {
			let envKey = key.toUpperCase().replace(/\./g, '_');
			value = process.env[envKey];
			console.debug(envKey, process.env[envKey])
			if (value === undefined || value === "") {
				missingFields.push(key);
			}
		}
	}
	
	// Regenerate pubkey if missing and secretkey is present
	if (missingFields.includes("server.pubkey") && !missingFields.includes("server.secretKey")){
		console.warn("No pubkey found in config file. Generating new pubkey.")
		const pubkey = await getPubkeyFromSecret(config.get("server.secretKey"));
		if (pubkey !== "") {
			missingFields = missingFields.filter((field) => field !== "server.pubkey");
			await updateLocalConfigKey("server.pubkey", pubkey);
			let configServer = Object.assign({}, app.get("config.server"));
			configServer.pubkey = pubkey;
			app.set("config.server", configServer);
		}
	}

	// Pubkey and secretkey generation if missing
	if (missingFields.includes("server.pubkey") || missingFields.includes("server.secretKey")){
		console.warn("No pubkey or secret key found in config file. Generating new keys.")
		const keyPair = await createkeyPair();
		if (keyPair.publicKey && keyPair.secretKey){
			missingFields = missingFields.filter((field) => field !== "server.pubkey" && field !== "server.secretKey");
			await updateLocalConfigKey("server.pubkey", keyPair.publicKey) && await updateLocalConfigKey("server.secretKey", keyPair.secretKey);
			let configServer = Object.assign({}, app.get("config.server"));
			configServer.pubkey = keyPair.publicKey;
			configServer.secretKey = keyPair.secretKey;
			app.set("config.server", configServer);
		}
	}

	if (missingFields.length > 0){
		console.error(" ------------------------------------------------------------ ")
		console.error("|  Empty necessary fields in local config file.              |")
		console.error("|  Please edit config file and then restart the app.         |")
		console.error("|  Execute: nano config/local.json                           |")
		console.error(" ------------------------------------------------------------ ")
		console.error(" For more information visit:")
		console.error(" https://github.com/quentintaranpino/nostrcheck-api-ts/blob/main/configuration.md") 
		console.error(" ")
		console.error(" Missing fields: ");
		missingFields.forEach((field) => {
			console.error(" " + field);
		});
		console.error(" ")
		exit(1);
	}

}

const syncDefaultConfigValues = async (defaultConf : string, localConf: string) : Promise<void> => {

	//Compare default config with local config json files
	const DefaultConfig = JSON.parse(fs.readFileSync(defaultConf).toString());
	const LocalConfig = JSON.parse(fs.readFileSync(localConf).toString());
	
	const configChanged = await mergeConfigkey(DefaultConfig, LocalConfig);
	if (!configChanged) return;
	
	try{
		console.debug("Updating config file: " + localConf)
		fs.copyFileSync(localConf, localConf + ".bak");
		fs.writeFileSync(localConf, JSON.stringify(LocalConfig, null, 4));
	}catch(err){
		console.error("Error writing config file: ", err);
		console.error("Please make sure the file is writable and then restart the server")
		exit(1);
	}
	
};

let hasChanged = false;
const mergeConfigkey = async (defaultConfig: Record<string, unknown>, localConfig: Record<string, unknown>): Promise<boolean> => {
    const promises = [];

    for (const key in defaultConfig) {
        if (typeof defaultConfig[key] === 'object' && defaultConfig[key] !== null && !Array.isArray(defaultConfig[key])) {
            if (!localConfig[key]){
                localConfig[key] = {};
                hasChanged = true;
            }
            promises.push(mergeConfigkey(defaultConfig[key] as Record<string, unknown>, localConfig[key] as Record<string, unknown>));
        } else if (!Object.prototype.hasOwnProperty.call(localConfig, key)) {
            localConfig[key] = defaultConfig[key];
            console.warn("Missing config key: " + key + " - Adding default value:", defaultConfig[key]);
            hasChanged = true;
        }
    }

    await Promise.all(promises);
    return hasChanged;
}

const updateLocalConfigKey = async (key: string, value: string) : Promise<boolean> => {
	
	try {

		const LocalConfig = JSON.parse(fs.readFileSync(localPath).toString());

		// Split the key into its parts
		const keyParts = key.split(".");

		// Start with the full config object
		let currentPart = LocalConfig;

		// Loop over all parts of the key except the last one
		for (let i = 0; i < keyParts.length - 1; i++) {
			// If this part of the key doesn't exist yet, create it as an empty object
			if (!currentPart[keyParts[i]]) {
				currentPart[keyParts[i]] = {};
			}

			// Move to the next part of the object
			currentPart = currentPart[keyParts[i]];
		}

		// Set the value on the last part of the key
		currentPart[keyParts[keyParts.length - 1]] = value;


        console.debug("Updating config file: " + localPath + " with key: " + key + " and value: " + value)
        fs.copyFileSync(localPath, localPath + ".bak");
        fs.writeFileSync(localPath, JSON.stringify(LocalConfig, null, 4));

        return true;
    } catch(err) {
        console.error("Error writing config file: ", err);
        return false;
    }
}

const loadConfigOptions = async (section:string) : Promise<Modules> => {
	return config.get(section);;
}

const loadconfigActiveModules = (app: Application) : [string, Module][] => {

	const availableModules = Object.entries(app.get("config.server")["availableModules"] as Record<string, Module>);
	const activeModules = availableModules.filter((module) => module[1]["enabled"] == true);

	return activeModules;
}

const isModuleEnabled = (moduleName: string, app: Application) : boolean => {
	const availableModules = loadconfigActiveModules(app)
	const module = availableModules.find((module) => module[0] === moduleName);
	if (module){
		return module[1]["enabled"];
	}else{
		return false;
	}
}

async function prepareAPP() {
    await prepareAPPConfig();
	await prepareAppFolders();
}

export { updateLocalConfigKey, loadConfigOptions, loadconfigActiveModules, isModuleEnabled, prepareAPP };
