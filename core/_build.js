import {} from "dotenv/config";
import { writeFileSync, readFileSync } from "fs";
import { resolve as resolvePath } from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import login from "skibidi-fca-v2";
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
const MAX_LOGIN_RETRIES = 3;
const RETRY_DELAY = 5000;

process.stdout.write(
    String.fromCharCode(27) + "]0;" + "Xavia" + String.fromCharCode(7)
);

const setupProcessHandlers = () => {
    const handlers = {
        unhandledRejection: (reason, promise) => {
            logger.error(`Unhandled Rejection at: ${promise}\nReason: ${reason}`);
        },
        uncaughtException: (err, origin) => {
            logger.error(`Uncaught Exception: ${err}\nOrigin: ${origin}`);
        },
        exit: () => {
            logger.system("Shutting down...");
            clearInterval(global.refreshState);
            clearInterval(global.refreshMqtt);
            if (global.listenMqtt) global.listenMqtt.stopListening();
            process.exit();
        }
    };

    process.on("unhandledRejection", handlers.unhandledRejection);
    process.on("uncaughtException", handlers.uncaughtException);
    ["SIGINT", "SIGTERM", "SIGHUP"].forEach(signal => {
        process.on(signal, handlers.exit);
    });

    global.shutdown = handlers.exit;
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const getAppState = async () => {
    try {
        const { APPSTATE_PATH, APPSTATE_PROTECTION } = global.config;
        
        if (APPSTATE_PROTECTION && isReplit) {
            const db = new replitDB();
            const secretKey = await db.get("APPSTATE_SECRET_KEY");
            if (!secretKey) throw new Error("Secret key not found");
            
            const encryptedState = JSON.parse(readFileSync(APPSTATE_PATH, 'utf8'));
            return JSON.parse(global.modules.get("aes").decrypt(encryptedState, secretKey));
        }
        
        const statePath = isGlitch 
            ? resolvePath(process.cwd(), ".data", "appstate.json")
            : APPSTATE_PATH;
            
        return JSON.parse(readFileSync(statePath, 'utf8'));
    } catch (err) {
        throw new Error(`Failed to read AppState: ${err.message}`);
    }
};

const saveAppState = async (api) => {
    try {
        const newAppState = api.getAppState();
        const { APPSTATE_PATH, APPSTATE_PROTECTION } = global.config;
        
        if (APPSTATE_PROTECTION && isReplit) {
            const db = new replitDB();
            const secretKey = await db.get("APPSTATE_SECRET_KEY");
            if (secretKey) {
                const encrypted = global.modules.get("aes").encrypt(
                    JSON.stringify(newAppState),
                    secretKey
                );
                writeFileSync(APPSTATE_PATH, JSON.stringify(encrypted));
            }
        } else {
            const savePath = isGlitch 
                ? resolvePath(process.cwd(), ".data", "appstate.json")
                : APPSTATE_PATH;
            writeFileSync(savePath, JSON.stringify(newAppState, null, 2));
        }
        
        return true;
    } catch (err) {
        logger.error("Failed to save AppState:", err);
        return false;
    }
};

const loginWithRetry = async (retryCount = 0) => {
    try {
        const appState = await getAppState();
        const { FCA_OPTIONS } = global.config;
        
        return new Promise((resolve, reject) => {
            login({ appState }, FCA_OPTIONS, async (error, api) => {
                if (error) {
                    if (retryCount < MAX_LOGIN_RETRIES) {
                        logger.warn(`Login attempt ${retryCount + 1} failed. Retrying...`);
                        await delay(RETRY_DELAY);
                        resolve(loginWithRetry(retryCount + 1));
                    } else {
                        reject(new Error(`Failed to login after ${MAX_LOGIN_RETRIES} attempts`));
                    }
                } else {
                    resolve(api);
                }
            });
        });
    } catch (err) {
        throw new Error(`Login failed: ${err.message}`);
    }
};

const setupListeners = async (api) => {
    const listenerID = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    global.listenerID = listenerID;
    
    try {
        const handler = await handleListen(listenerID);
        global.listenMqtt = api.listenMqtt(handler);
        
        global.refreshMqtt = setInterval(async () => {
            logger.custom("Refreshing MQTT connection", "REFRESH");
            const newListenerID = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
            if (global.listenMqtt) global.listenMqtt.stopListening();
            global.listenerID = newListenerID;
            global.listenMqtt = api.listenMqtt(await handleListen(newListenerID));
        }, TWO_HOURS);
        
        global.refreshState = setInterval(async () => {
            logger.custom("Saving AppState", "REFRESH");
            await saveAppState(api);
        }, TWELVE_HOURS);
        
    } catch (err) {
        throw new Error(`Failed to setup listeners: ${err.message}`);
    }
};

const initializeBot = async (api) => {
    try {
        global.api = api;
        global.botID = api.getCurrentUserID();
        logger.custom(`Bot logged in successfully as ${global.botID}`, "LOGIN");
        
        await setupListeners(api);
        
        if (global.config.REFRESH) {
            setTimeout(() => {
                logger.system("Scheduled restart initiated");
                global.restart();
            }, global.config.REFRESH);
        }
        
        return true;
    } catch (err) {
        throw new Error(`Bot initialization failed: ${err.message}`);
    }
};

const initializeServer = () => {
    try {
        const serverPassword = crypto.randomBytes(8).toString('hex');
        startServer(serverPassword);
        process.env.SERVER_ADMIN_PASSWORD = serverPassword;
        return true;
    } catch (err) {
        throw new Error(`Server initialization failed: ${err.message}`);
    }
};

const start = async () => {
    try {
        setupProcessHandlers();
        
        await _init_var();
        logger.system("Variables initialized successfully");
        
        await initDatabase();
        global.updateJSON = updateJSON;
        global.updateMONGO = updateMONGO;
        global.controllers = { Threads: _Threads, Users: _Users };
        logger.system("Database initialized successfully");
        
        if (!initializeServer()) {
            throw new Error("Server initialization failed");
        }
        
        logger.custom("Attempting login...", "LOGIN");
        const api = await loginWithRetry();
        await initializeBot(api);
        
        logger.system("Bot started successfully");
    } catch (err) {
        logger.error("Startup failed:", err);
        await delay(1000);
        process.exit(1);
    }
};

process.on('exit', () => {
    try {
        if (global.api) saveAppState(global.api);
    } catch (err) {
        logger.error("Failed to save AppState during shutdown:", err);
    }
});

start();
