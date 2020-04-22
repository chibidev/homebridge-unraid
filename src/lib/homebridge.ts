import { TypedEventEmitter } from "../util/events";
import * as Config from "./config";
import * as hap from "hap-nodejs";

export namespace HomeBridge {
    // Importing the PlatformAccessory class directly will create a different PlatformAccessory class
    // than what homebridge is using when importing our plugin. Therefore in order not to duplicate the
    // class and result in an error thrown by the server (due to the differing type), we're using the parent
    // module to import the constructor.
    //
    // With this we can run homebridge without having to install/deploy homebridge-unraid every single time.
    //
    // Since type and constructor are two different things in Typescript, we need two declarations of the same
    // thing.
    //
    // If Homebridge ever migrates to Typescript, this will be easily replaced by a similar single import
    // statement.
    //
    // import { PlatformAccessory } from "homebridge/lib/platformAccessory";

    interface PlatformAccessoryEvents {
        identify: boolean;
    }

    export interface PlatformAccessory {
        reachable: boolean;
        displayName: string;
        UUID: string;
        category: hap.Categories;
        services: hap.Service[];
        context: any;

        addService(service: hap.Service): hap.Service;
        addService(service: { new (...params: any[]) : hap.Service }, ...params: any[]): hap.Service;
        removeService(service: hap.Service): void;
        getService(serviceName: string): hap.Service | undefined;
        getService(service: typeof hap.Service): hap.Service | undefined;
        getServiceByUUIDAndSubType(serviceName: string, subtype: string): hap.Service | undefined;
        getServiceByUUIDAndSubType(uuid: string, subtype: string): hap.Service | undefined;
        getServiceByUUIDAndSubType(service: typeof hap.Service, subtype: string): hap.Service | undefined;
        updateReachability(reachable: false): void;

        on<K extends keyof PlatformAccessoryEvents>(name: K, listener: (value: PlatformAccessoryEvents[K], ...params: any[]) => void): this;
    }

    export const PlatformAccessory: new(name: string, uuid: string) => PlatformAccessory = require.main?.require("../lib/platformAccessory").PlatformAccessory;

    export interface Logger {
        debug(message: string): void;
        info(message: string): void;
        warn(message: string): void;
        error(message: string): void;
    }

    export type Config = Config.Config;
    export type ConfigTraits<T> = Config.Traits<T>;

    export const InitConfig = Config.initialize;
    export const InitialConfigVersionNumber = Config.InitialVersionNumber;
    export const NextVersion = Config.nextVersion;

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

    export abstract class Accessory {
        public constructor(log: Logger, config: Config | null) {
        }

        public abstract getServices(): hap.Service[];
    }

    export interface AccessoryAPI {
        registerAccessory(pluginName: string, accessoryName: string, constructor: typeof Accessory/*, configurationRequestHandler: any */): void; // intentionally excluding last parameter from exposed interface
        publishCameraAccessories(pluginName: string, accessories: PlatformAccessory[]): void;
        publishExternalAccessories(pluginName: string, accessories: PlatformAccessory[]): void;
    }

    export interface PlatformAPI extends TypedEventEmitter<APIEvents> {
        platform(name: string): any;

        registerPlatform(pluginName: string, platformName: string, constructor: typeof Platform, dynamic: boolean): void;
        registerPlatformAccessories(pluginName: string, platformName: string, accessories: PlatformAccessory[]): void;
        // updatePlatformAccessories(accessories: PlatformAccessory[]): void; // intentionally excluding
        unregisterPlatformAccessories(pluginName: string, platformName: string, accessories: PlatformAccessory[]): void;
    }

    export interface API extends AccessoryAPI, PlatformAPI {
        readonly version: number;
        readonly serverVersion: number;
        readonly user: User;
        // hap: HAP; // intentionally excluding from exported interface
        // hapLegacyTypes: any; // intentionally excluding from exported interface
        readonly platformAccessory: typeof PlatformAccessory;
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
        public constructor(log: HomeBridge.Logger, config: Config | null, api: PlatformAPI) {
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

        protected api: PlatformAPI;
    }
}