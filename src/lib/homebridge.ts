import { TypedEventEmitter } from "../util/events";
import * as hap from 'hap-nodejs';

export namespace HomeBridge {
    export namespace Accessories {
        export enum Status {
            On,
            Off
        };

        interface PlatformAccessoryEvents {
            identify: boolean;
        }

        export abstract class PlatformAccessory extends TypedEventEmitter<PlatformAccessoryEvents> {
            reachable: boolean;
            displayName: string;
            UUID: string;

            abstract addService(service: hap.Service): hap.Service;
            abstract addService(service: { new (...params: any[]) : hap.Service }, ...params: any[]): hap.Service;
            abstract removeService(service: hap.Service): void;
            abstract getService(serviceName: string): hap.Service;
            abstract updateReachability(reachable: false): void;
        }

        export class Context {
            constructor(private readonly platformAccessory: { new (name: string, uuid: string) : PlatformAccessory }) {
            }

            createPlatformAccessory(accessoryName: string): Accessories.PlatformAccessory {
                const uuid = hap.uuid.generate(accessoryName);
            
                const newAccessory = new this.platformAccessory(accessoryName, uuid);
                newAccessory.on('identify', (_paired, callback) => {
                    callback();
                });

                return newAccessory;
            }

            createSwitch(accessoryName: string, initialStatus: Status, trigger: (value: boolean, callback: any) => void) {
                const accessory = this.createPlatformAccessory(accessoryName);
                const switchService = accessory.addService(hap.Service.Switch, accessoryName);

                switchService.setCharacteristic(hap.Characteristic.On, initialStatus == Status.On);
                switchService.getCharacteristic(hap.Characteristic.On)?.on(hap.CharacteristicEventTypes.SET, trigger);

                return accessory;
            }
        }
    }

    export interface Logger {
        debug(message: string): void;
        info(message: string): void;
        warn(message: string): void;
        error(message: string): void;
    }

    export interface Config {
    }

    // export interface HAP {
    //     Service: typeof hap.Service;
    //     Characteristic: typeof hap.Characteristic;
    //     uuid: UUIDGenerator;
    // }

    export interface UUID {
    }

    export interface UUIDGenerator {
        generate(name: string) : UUID;
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
        publishExternalAccessories: Accessories.PlatformAccessory[];
        registerPlatformAccessories: Accessories.PlatformAccessory[];
        updatePlatformAccessories: Accessories.PlatformAccessory[];
        unregisterPlatformAccessories: Accessories.PlatformAccessory[];
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
        publishCameraAccessories(pluginName: string, accessories: Accessories.PlatformAccessory[]): void;
        publishExternalAccessories(pluginName: string, accessories: Accessories.PlatformAccessory[]): void;

        platform(name: string): any;

        registerPlatform(pluginName: string, platformName: string, constructor: typeof Platform, dynamic: boolean): void;
        registerPlatformAccessories(pluginName: string, platformName: string, accessories: Accessories.PlatformAccessory[]): void;
        updatePlatformAccessories(accessories: Accessories.PlatformAccessory[]): void;
        unregisterPlatformAccessories(pluginName: string, platformName: string, accessories: Accessories.PlatformAccessory[]): void;
    }

    export interface PlatformContext {
        preferedLanguage: string;
    }

    export interface ConfigurationRequest {
    }

    export interface ConfigurationResponse {
        tid: number;
        sid: UUID;
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
        public abstract configureAccessory(accessory: Accessories.PlatformAccessory) : void;

        // Handler will be invoked when user try to config your plugin.
        // Callback can be cached and invoke when necessary.
        public configurationRequestHandler(context: PlatformContext, request: ConfigurationRequest, callback: ConfigurationRequestCallback) : void {
        }

        protected api: API;
    }
}