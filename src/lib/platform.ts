import * as HomeBridge from "./homebridge";
import { initialize as InitConfig } from "./config";
import { TypedEventEmitter } from "../util/events";
import "../util/iterable";

import * as Messages from './messages';

interface PluginEvents {
    accessoriesUpdated: HomeBridge.Platform.Accessory[];
}

export abstract class Plugin extends TypedEventEmitter<PluginEvents> {
    public constructor(log: HomeBridge.Logger, config: HomeBridge.Config.Config) {
        super();
        this.logger = log;
    }
    
    public configureCachedAccessory(accessory: HomeBridge.Platform.Accessory): boolean {
        return false;
    }

    public accessories(): Promise<HomeBridge.Platform.Accessory[]> {
        let accessories = this.updateAccessories();
        accessories.then((accessories) => {
            this.emit("accessoriesUpdated", accessories);
        });

        return accessories;
    }

    public configure(): void {
    }
    
    protected abstract updateAccessories(): Promise<HomeBridge.Platform.Accessory[]>;
    
    protected logger: HomeBridge.Logger;
}

export abstract class PollingPlugin extends Plugin {
    public constructor(log: HomeBridge.Logger, config: HomeBridge.Config.Config, secondsInterval: number) {
        super(log, config);

        this.secondsInterval = secondsInterval;
        this.timerID = null;
    }

    public async accessories(): Promise<HomeBridge.Platform.Accessory[]> {
        let accessories = this.poll();
        this.startPolling();
        return accessories;
    }

    private async poll(): Promise<HomeBridge.Platform.Accessory[]> {
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

type PluginConstructor<PluginType extends Plugin, ConfigType extends HomeBridge.Config.Config> = {
    new (log: HomeBridge.Logger, config: ConfigType): PluginType;
}

class DynamicWithPlugin<PluginType extends Plugin, ConfigType extends HomeBridge.Config.Config> extends HomeBridge.Platform.Dynamic {
    public constructor(pluginName: string, platformName: string, pluginConstructor: PluginConstructor<PluginType, ConfigType>, configTraits: HomeBridge.Config.Traits<ConfigType>, log: HomeBridge.Logger, config: ConfigType | null, api: HomeBridge.API.PlatformAPI) {
        if (config === null)
            log.warn(Messages.NoConfig);
        else if (configTraits.versionFunction(config) != configTraits.currentVersionIdentifier)
            log.warn(Messages.ConfigUpdateRequired);

        config = InitConfig(config, configTraits);

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

    private updateAccessories(accessories: HomeBridge.Platform.Accessory[]): void {
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

    public configureAccessory(accessory: HomeBridge.Platform.Accessory): void {
        if (this.platformPlugin.configureCachedAccessory(accessory))
            this.registeredAccessories.push(accessory);
        else
            this.api.unregisterPlatformAccessories(this.pluginName, this.platformName, [accessory]);
    }

    private platformPlugin: PluginType;
    private registeredAccessories: HomeBridge.Platform.Accessory[];
    private pluginName: string;
    private platformName: string;
}

export function register<PluginType extends Plugin, ConfigType extends HomeBridge.Config.Config>(pluginName: string, platformName: string, pluginConstructor: PluginConstructor<PluginType, ConfigType>, configTraits: HomeBridge.Config.Traits<ConfigType>) {
    const originalConstructor = DynamicWithPlugin;
    const modifiedConstructor = originalConstructor.bind(null, pluginName, platformName, pluginConstructor, configTraits);

    return (api: HomeBridge.API.PlatformRegisterAPI) => {
        // For platform plugin to be considered as dynamic platform plugin,
        // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
        api.registerPlatform(pluginName, platformName, modifiedConstructor, true);
    };
}