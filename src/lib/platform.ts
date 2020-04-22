import { HomeBridge } from "../lib/homebridge";
import { Config } from "../server/models/config";
import { TypedEventEmitter } from "../util/events";
import "../util/iterable";

import * as Messages from './messages';

interface PluginEvents {
    accessoriesUpdated: HomeBridge.PlatformAccessory[];
}

export abstract class PlatformPlugin extends TypedEventEmitter<PluginEvents> {
    public constructor(log: HomeBridge.Logger, config: Config.Config) {
        super();
        this.logger = log;
    }
    
    public configureCachedAccessory(accessory: HomeBridge.PlatformAccessory): boolean {
        return false;
    }

    public accessories(): Promise<HomeBridge.PlatformAccessory[]> {
        let accessories = this.updateAccessories();
        accessories.then((accessories) => {
            this.emit("accessoriesUpdated", accessories);
        });

        return accessories;
    }

    public configure(): void {
    }
    
    protected abstract updateAccessories(): Promise<HomeBridge.PlatformAccessory[]>;
    
    protected logger: HomeBridge.Logger;
}

export abstract class PollingPlugin extends PlatformPlugin {
    public constructor(log: HomeBridge.Logger, config: Config.Config, secondsInterval: number) {
        super(log, config);

        this.secondsInterval = secondsInterval;
        this.timerID = null;
    }

    public async accessories(): Promise<HomeBridge.PlatformAccessory[]> {
        let accessories = this.poll();
        this.startPolling();
        return accessories;
    }

    private async poll(): Promise<HomeBridge.PlatformAccessory[]> {
        let accessories = this.updateAccessories();
        accessories.then((accessories) => {
            this.emit("accessoriesUpdated", accessories);
        });

        return accessories;
    }

    protected startPolling() {
        if (this.timerID != null)
            return;

        this.timerID = setInterval(() => {
            this.poll();
        }, this.secondsInterval * 1000);
    }

    protected stopPolling() {
        if (this.timerID == null)
            return;

        clearInterval(this.timerID);
        this.timerID = null;
    }

    private secondsInterval: number;
    private timerID: NodeJS.Timeout | null;
}

export type PluginConstructor<PluginType extends PlatformPlugin, ConfigType extends HomeBridge.Config> = {
    new (log: HomeBridge.Logger, config: ConfigType): PluginType;
}

class Platform<PluginType extends PlatformPlugin, ConfigType extends HomeBridge.Config> extends HomeBridge.Platform {
    public constructor(pluginName: string, platformName: string, pluginConstructor: PluginConstructor<PluginType, ConfigType>, configTraits: HomeBridge.ConfigTraits<ConfigType>, log: HomeBridge.Logger, config: ConfigType | null, api: HomeBridge.PlatformAPI) {
        if (config === null)
            log.warn(Messages.NoConfig);
        else if (configTraits.versionFunction(config) != configTraits.currentVersionNumber)
            log.warn(Messages.ConfigUpdateRequired);

        config = HomeBridge.InitConfig(config, configTraits);

        super(log, config, api);

        this.platformName = platformName;
        this.pluginName = pluginName;
        this.registeredAccessories = [];

        if (api) {
            // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
            // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
            // Or start discovering new accessories.
            this.platformPlugin = new pluginConstructor(log, config);
            
            this.api.on('didFinishLaunching', () => {
                this.platformPlugin.configure();
                this.platformPlugin.on('accessoriesUpdated', this.updateAccessories.bind(this));
                this.platformPlugin.accessories();
            });
        }
    }

    private updateAccessories(accessories: HomeBridge.PlatformAccessory[]): void {
        const accessoriesToRemove = this.registeredAccessories.difference(accessories, (lhs, rhs) => {
            return lhs.displayName == rhs.displayName;
        });
        
        const newAccessories = accessories.difference(this.registeredAccessories, (lhs, rhs) => {
            return lhs.displayName == rhs.displayName;
        });

        if (accessoriesToRemove.length > 0) {
            this.api.unregisterPlatformAccessories(this.pluginName, this.platformName, accessoriesToRemove);
            this.registeredAccessories = this.registeredAccessories.difference(accessoriesToRemove, (lhs, rhs) => {
                return lhs.displayName == rhs.displayName
            });
        }

        if (newAccessories.length > 0) {
            this.api.registerPlatformAccessories(this.pluginName, this.platformName, newAccessories);
            this.registeredAccessories = this.registeredAccessories.concat(newAccessories);
        }
    }

    public configureAccessory(accessory: HomeBridge.PlatformAccessory): void {
        if (this.platformPlugin.configureCachedAccessory(accessory))
            this.registeredAccessories.push(accessory);
        else
            this.api.unregisterPlatformAccessories(this.pluginName, this.platformName, [accessory]);
    }
    
    public configurationRequestHandler(context: HomeBridge.PlatformContext, request: HomeBridge.ConfigurationRequest, callback: HomeBridge.ConfigurationRequestCallback): void {
    }

    private platformPlugin: PluginType;
    private registeredAccessories: HomeBridge.PlatformAccessory[];
    private pluginName: string;
    private platformName: string;
}

export function register<PluginType extends PlatformPlugin, ConfigType extends HomeBridge.Config>(pluginName: string, platformName: string, pluginConstructor: PluginConstructor<PluginType, ConfigType>, configTraits: HomeBridge.ConfigTraits<ConfigType>) {
    const originalConstructor = Platform;
    const modifiedConstructor = originalConstructor.bind(null, pluginName, platformName, pluginConstructor, configTraits);

    return (api: HomeBridge.PlatformAPI) => {
        // For platform plugin to be considered as dynamic platform plugin,
        // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
        api.registerPlatform(pluginName, platformName, modifiedConstructor, true);
    };
}