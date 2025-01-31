import {} from "dotenv/config";
import { writeFileSync } from "fs";
import { resolve as resolvePath } from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import login from "@xaviabot/fca-unofficial";
import replitDB from "@replit/database";

import logger from "./var/modules/logger.js";
import startServer from "./dashboard/server/app.js";
import handleListen from "./handlers/listen.js";
import environments from "./var/modules/environments.get.js";
import _init_var from "./var/_init.js";
import {
    initDatabase,
    updateJSON,
    updateMONGO,
    _Threads,
    _Users,
} from "./handlers/database.js";

const { isGlitch, isReplit } = environments;
const TWELVE_HOURS = 1000 * 60 * 60 * 12;
const TWO_HOURS = 1000 * 60 * 60 * 2;

process.stdout.write(
    String.fromCharCode(27) + "]0;" + "Xavia" + String.fromCharCode(7)
);

const setupProcessHandlers = () => {
    process.on("unhandledRejection", (reason, promise) => {
        console.error("Unhandled Rejection:", reason);
    });

    process.on("uncaughtException", (err, origin) => {
        logger.error(`Uncaught Exception: ${err} at ${origin}`);
    });

    ["SIGINT", "SIGTERM", "SIGHUP"].forEach(signal => {
        process.on(signal, () => {
            logger.system(getLang("build.start.exit"));
            global.shutdown();
        });
    });
};

const generateListenerID = () => {
    return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
};

const saveAppState = async (api, config) => {
    const newAppState = api.getAppState();
    
    if (config.APPSTATE_PROTECTION && isReplit) {
        try {
            const db = new replitDB();
            const secretKey = await db.get("APPSTATE_SECRET_KEY");
            if (secretKey) {
                const encrypted = global.modules.get("aes").encrypt(
                    JSON.stringify(newAppState),
                    secretKey
                );
                writeFileSync(config.APPSTATE_PATH, JSON.stringify(encrypted));
            }
        } catch (err) {
            logger.error("Failed to save encrypted appstate:", err);
        }
    } else {
        const savePath = isGlitch 
            ? resolvePath(process.cwd(), ".data", "appstate.json")
            : config.APPSTATE_PATH;
        writeFileSync(savePath, JSON.stringify(newAppState, null, 2));
    }
};

const setupRefreshHandlers = (api) => {
    global.refreshState = setInterval(async () => {
        logger.custom(getLang("build.refreshState"), "REFRESH");
        await saveAppState(api, global.config);
    }, TWELVE_HOURS);

    global.refreshMqtt = setInterval(async () => {
        logger.custom(getLang("build.refreshMqtt"), "REFRESH");
        const newListenerID = generateListenerID();
        global.listenMqtt.stopListening();
        global.listenerID = newListenerID;
        global.listenMqtt = api.listenMqtt(
            await handleListen(newListenerID)
        );
    }, TWO_HOURS);
};

const loginWithState = async () => {
    const { APPSTATE_PATH, APPSTATE_PROTECTION, FCA_OPTIONS } = global.config;
    
    try {
        const appState = await global.modules.get("checkAppstate")(
            APPSTATE_PATH,
            APPSTATE_PROTECTION
        );

        return new Promise((resolve, reject) => {
            login({ appState }, FCA_OPTIONS, (error, api) => {
                if (error) reject(error.error || error);
                else resolve(api);
            });
        });
    } catch (err) {
        if (isGlitch) {
            const appStatePath = resolvePath(process.cwd(), ".data", "appstate.json");
            if (global.isExists(appStatePath, "file")) {
                global.deleteFile(appStatePath);
                execSync("refresh");
            }
        }
        throw err;
    }
};

const initializeBot = async (api) => {
    global.api = api;
    global.botID = api.getCurrentUserID();
    logger.custom(getLang("build.booting.logged", { botID: global.botID }), "LOGIN");

    setupRefreshHandlers(api);

    if (global.config.REFRESH) {
        setTimeout(() => global.restart(), global.config.REFRESH);
    }

    const newListenerID = generateListenerID();
    global.listenerID = newListenerID;
    global.listenMqtt = api.listenMqtt(await handleListen(newListenerID));
};

const initializeServer = () => {
    const serverPassword = crypto.randomBytes(4).toString('hex');
    startServer(serverPassword);
    process.env.SERVER_ADMIN_PASSWORD = serverPassword;
};

const start = async () => {
    try {
        setupProcessHandlers();
        await _init_var();
        logger.system(getLang("build.start.varLoaded"));
        
        await initDatabase();
        global.updateJSON = updateJSON;
        global.updateMONGO = updateMONGO;
        global.controllers = { Threads: _Threads, Users: _Users };
        
        initializeServer();
        
        logger.custom(getLang("build.booting.logging"), "LOGIN");
        const api = await loginWithState();
        await initializeBot(api);
    } catch (err) {
        logger.error("Startup failed:", err);
        global.shutdown();
    }
};

start();
