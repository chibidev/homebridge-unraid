import * as homebridge from "homebridge";

import { TypedEventEmitter } from "../util/events";
import * as config from "./config";
import * as platform from "./platform";

// In order to save plugins from depending on hap-nodejs, we import
// and export it with a tiny twist.
// Importing like this so that type information is available in
// development time, but it won't try to load a different version
// of hap-nodejs runtime. Ugly, but works.
import type * as HAP from "homebridge/node_modules/hap-nodejs";

export namespace hap {
    export type Categories = HAP.Categories;
    export type Service = HAP.Service;
}
export const hap: typeof HAP = require.main?.require("hap-nodejs");

export type Logger = homebridge.Logger;

export namespace Config {
    export type Config = config.Config;
    export type Traits<T> = config.Traits<T>;
    export type Version = config.Version;

    export const InitialConfigVersionIdentifier = config.InitialVersionIdentifier;
    export const NextVersion = config.nextVersion;
}

// Intentionally re-declaring API interface to restrict usage of non-platform-related methods
export namespace API {
    interface Events {
        didFinishLaunching: void;
        shutdown: void;
    }

    export interface PlatformRegisterAPI {
        platform(name: string): any;

        registerPlatform(pluginName: string, platformName: string, constructor: typeof Platform.Dynamic, dynamic: boolean): void;
    }

    export interface PlatformAPI extends TypedEventEmitter<Events> {
        registerPlatformAccessories(pluginName: string, platformName: string, accessories: Platform.Accessory[]): void;
        // updatePlatformAccessories(accessories: PlatformAccessory[]): void; // intentionally excluding
        unregisterPlatformAccessories(pluginName: string, platformName: string, accessories: Platform.Accessory[]): void;
    }
}

export namespace Platform {
    // Importing the PlatformAccessory class directly will create a different PlatformAccessory class
    // than what homebridge is using when importing our plugin. Therefore in order not to duplicate the
    // class and result in an error thrown by the server (due to the differing type), we're using the parent
    // module to import the constructor.
    //
    // With this we can run homebridge without having to install/deploy homebridge-unraid every single time.
    //
    // Since type and constructor are two different things in Typescript, we need two declarations of the same
    // thing.
    export type Accessory = homebridge.PlatformAccessory;
    export const Accessory: new(name: string, uuid: string) => Accessory = require.main?.require("../lib/platformAccessory").PlatformAccessory;

    export abstract class Dynamic implements homebridge.DynamicPlatformPlugin {
        // Platform constructor
        // config may be null
        // api may be null if launched from old homebridge version
        public constructor(log: Logger, config: Config.Config | null, api: API.PlatformAPI) {
            this.api = api;
        }
        
        // Function invoked when homebridge tries to restore cached accessory.
        // Developer can configure accessory at here (like setup event handler).
        // Update current value.
        public abstract configureAccessory(accessory: Accessory) : void;

        protected api: API.PlatformAPI;
    }

    export const register = platform.register;
    export type Plugin = platform.Plugin;
    export const Plugin = platform.Plugin;

    export type PollingPlugin = platform.PollingPlugin;
    export const PollingPlugin = platform.PollingPlugin;
}