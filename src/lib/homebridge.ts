import { TypedEventEmitter } from "../util/events";
import { PlatformAccessory } from "homebridge/lib/platformAccessory";
import { compose } from "../util/functional";

export namespace HomeBridge {
    export interface Logger {
        debug(message: string): void;
        info(message: string): void;
        warn(message: string): void;
        error(message: string): void;
    }

    export interface Config {
    }

    export type PlatformConstructor = {
        new(log: Logger, config: Config, api: API): Platform;
    }

    export interface User {
        config: any;
        storagePath: string;
        configPath: string;
        persistPath: string;
        cachedAccessoriesPath: string;
        
        setStoragePath(path: string): void;
    }

    interface APIEvents {
        publishExternalAccessories: PlatformAccessory[];
        registerPlatformAccessories: PlatformAccessory[];
        updatePlatformAccessories: PlatformAccessory[];
        unregisterPlatformAccessories: PlatformAccessory[];
        didFinishLaunching: void;
    }

    export interface API extends TypedEventEmitter<APIEvents> {
        version: number;
        serverVersion: number;
        user: User;
        // hap: HAP; // intentionally excluding from exported interface
        // hapLegacyTypes: any; // intentionally excluding from exported interface
        platformAccessory: any;

        registerAccessory(pluginName: string, accessoryName: string, constructor: any, configurationRequestHandler: any): void;
        publishCameraAccessories(pluginName: string, accessories: PlatformAccessory[]): void;
        publishExternalAccessories(pluginName: string, accessories: PlatformAccessory[]): void;

        platform(name: string): any;

        registerPlatform(pluginName: string, platformName: string, constructor: typeof Platform, dynamic: boolean): void;
        registerPlatformAccessories(pluginName: string, platformName: string, accessories: PlatformAccessory[]): void;
        updatePlatformAccessories(accessories: PlatformAccessory[]): void;
        unregisterPlatformAccessories(pluginName: string, platformName: string, accessories: PlatformAccessory[]): void;
    }

    export interface PlatformContext {
        preferedLanguage: string;
    }

    export interface ConfigurationRequest {
    }

    export interface ConfigurationResponse {
        tid: number;
        sid: string;
    }

    export enum ConfigurationType {
        accessory = "accessory",
        platform = "platform"
    }

    export interface ServerConfig {
    }

    export type ConfigurationRequestCallback = (response: ConfigurationResponse, type: ConfigurationType, replace: boolean, config: ServerConfig) => void;

    export abstract class Platform {
        // Platform constructor
        // config may be null
        // api may be null if launched from old homebridge version
        public constructor(log: HomeBridge.Logger, config: Config, api: API) {
            this.api = api;
        }
        
        // Function invoked when homebridge tries to restore cached accessory.
        // Developer can configure accessory at here (like setup event handler).
        // Update current value.
        public abstract configureAccessory(accessory: PlatformAccessory) : void;

        // Handler will be invoked when user try to config your plugin.
        // Callback can be cached and invoke when necessary.
        public configurationRequestHandler(context: PlatformContext, request: ConfigurationRequest, callback: ConfigurationRequestCallback) : void {
        }

        protected api: API;
    }
}