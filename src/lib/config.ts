import config from "config";
import fs from "fs";
import { exit } from "process";

const defaultPath : string = "./config/default.json";
const localPath : string = "./config/local.json";
import { IEndpoints } from "../interfaces/config.js";

function prepareAppFolders(){

	let TempPath : string = config.get("media.tempPath");

	//If not exist create temp folder
	if (!fs.existsSync(TempPath)){
		fs.mkdirSync(TempPath);
	}

	fs.readdir(TempPath, (err, files) => {
		if (err) {
			console.error(err);
            exit(1);
		}

		//Delete all files in temp folder
		for (const file of files) {
			fs.unlink(TempPath + file, (err) => {
				if (err) {
                    console.error(err);
                    exit(1);
				}
			});
		}
	});

	//If not exist create media folder
	const MediaPath : string = config.get("media.mediaPath");
	if (!fs.existsSync(MediaPath)){
		fs.mkdirSync(MediaPath);
	}

}

async function prepareAPPConfig(): Promise<boolean>{

    //If config file exist return
	if (fs.existsSync(localPath)){
		await syncDefaultConfigValues(defaultPath,localPath);
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

const syncDefaultConfigValues = async (defaultConf : string, localConf: string) : Promise<void> => {

	//Compare default config with local config json files
	const DefaultConfig = JSON.parse(fs.readFileSync(defaultConf).toString());
	const LocalConfig = JSON.parse(fs.readFileSync(localConf).toString());
	
	let configChanged = await mergeConfigkey(DefaultConfig, LocalConfig);
	if (!configChanged) return;
	
	try{
		console.debug("Updating config file: " + localConf)
		fs.copyFileSync(localConf, localConf + ".bak");
		fs.writeFileSync(localConf, JSON.stringify(LocalConfig, null, 4));
	}catch(err){
		console.error("Error writing config file: ", err);
	}
	
};

let hasChanged = false;

const mergeConfigkey = async (defaultConfig: any, localConfig: any): Promise<boolean> => {

    const promises = [];

    for (const key in defaultConfig) {
        if (typeof defaultConfig[key] === 'object' && defaultConfig[key] !== null && !Array.isArray(defaultConfig[key])) {
            if (!localConfig[key]){
                localConfig[key] = {};
                hasChanged = true;
            }
            promises.push(mergeConfigkey(defaultConfig[key], localConfig[key]));
        } else if (!localConfig.hasOwnProperty(key)) {
            localConfig[key] = defaultConfig[key];
            console.warn("Missing config key: " + key + " - Adding default value:", defaultConfig[key]);
            hasChanged = true;
        }
    }

    await Promise.all(promises);
    return hasChanged;
}

const updateLocalConfigKey = async (key: string, value: any) : Promise<boolean> => {
	
	const LocalConfig = JSON.parse(fs.readFileSync(localPath).toString());

	//If key is nested
	if (key.includes(".")){
		const keyArray = key.split(".");
		LocalConfig[keyArray[0]][keyArray[1]] = value;
	}else{
		LocalConfig[key] = value;
	}

	try{
		console.debug("Updating config file: " + localPath + " with key: " + key + " and value: " + value)
		fs.copyFileSync(localPath, localPath + ".bak");
		fs.writeFileSync(localPath, JSON.stringify(LocalConfig, null, 4));

		return true;

	}catch(err){
		console.error("Error writing config file: ", err);
		return false;
	}

}

// Load enabled API endpoints for runtime
const loadconfigEndpoints = async () : Promise<IEndpoints> => {

	const configEndpoints: IEndpoints = config.get("server.availableEendpoints");
	let runtimeEndpoints: IEndpoints = {};

	for (const endpoint in configEndpoints) {
		for (const [key, value] of Object.entries(configEndpoints[endpoint])) {

			if (key === "enabled" && value === true) {
				runtimeEndpoints[endpoint] = configEndpoints[endpoint];
			}
		}
	}
	return runtimeEndpoints;
}

async function prepareAPP() {
    await prepareAPPConfig();
	await prepareAppFolders();
}

export { updateLocalConfigKey, loadconfigEndpoints, prepareAPP };
