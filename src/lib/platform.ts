import { HomeBridge } from "../lib/homebridge";
import { Config } from "../server/models/config";
import { difference } from "../util/iterable";
import { TypedEventEmitter } from "../util/events";

interface PluginEvents {
    accessoriesUpdated: HomeBridge.Accessories.PlatformAccessory[];
}

export abstract class PlatformPlugin extends TypedEventEmitter<PluginEvents> {
    public constructor(log: HomeBridge.Logger, config: Config.Config) {
        super();
        this.logger = log;
    }
    
    public abstract updateAccessories(context: HomeBridge.Accessories.Context): Promise<void>;
    
    protected logger: HomeBridge.Logger;
}

export abstract class PollingPlugin extends PlatformPlugin {
    public constructor(log: HomeBridge.Logger, config: Config.Config, secondsInterval: number) {
        super(log, config);

        this.secondsInterval = secondsInterval;
        this.timerID = null;
    }

    public async updateAccessories(accessoryContext: HomeBridge.Accessories.Context): Promise<void> {
        this.lastAccessoryContext = accessoryContext;
        this.updateAccessoriesNow(accessoryContext);
        this.startPolling();
    }

    protected abstract async updateAccessoriesNow(accessoryContext: HomeBridge.Accessories.Context): Promise<void>;

    protected startPolling() {
        if (this.timerID != null)
            return;

        this.timerID = setInterval(() => {
            this.updateAccessoriesNow(this.lastAccessoryContext);
        }, this.secondsInterval * 1000);
    }

    protected stopPolling() {
        if (this.timerID == null)
            return;

        clearInterval(this.timerID);
        this.timerID = null;
    }

    private secondsInterval: number;
    private lastAccessoryContext: HomeBridge.Accessories.Context;
    private timerID: NodeJS.Timeout | null;
}

export type PluginConstructor<T> = {
    new (log: HomeBridge.Logger, config: Config.Config): T;
}

class Platform<PluginType extends PlatformPlugin> extends HomeBridge.Platform {
    public constructor(pluginName: string, platformName: string, pluginConstructor: PluginConstructor<PluginType>, log: HomeBridge.Logger, config: Config.Config, api: HomeBridge.API) {
        super(log, config, api);

        this.platformName = platformName;
        this.pluginName = pluginName;
        this.registeredAccessories = [];

        if (api) {
            let context = new HomeBridge.Accessories.Context(api.platformAccessory/*, api.hap.Service, api.hap.Characteristic, api.hap.uuid*/);
            // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
            // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
            // Or start discover new accessories.
            this.api.on('didFinishLaunching', () => {
                this.platformPlugin = new pluginConstructor(log, config);
                this.platformPlugin.on('accessoriesUpdated', this.updateAccessories.bind(this));
                this.platformPlugin.updateAccessories(context);
            });
        }
    }

    private updateAccessories(accessories: HomeBridge.Accessories.PlatformAccessory[]): void {
        const accessoriesToRemove = difference(this.registeredAccessories, accessories, (lhs, rhs) => {
            return lhs.displayName == rhs.displayName;
        });
        
        const newAccessories = difference(accessories, this.registeredAccessories, (lhs, rhs) => {
            return lhs.displayName == rhs.displayName;
        });

        if (accessoriesToRemove.length > 0) {
            this.api.unregisterPlatformAccessories(this.pluginName, this.platformName, accessoriesToRemove);
            this.registeredAccessories = difference(this.registeredAccessories, accessoriesToRemove, (lhs, rhs) => {
                return lhs.displayName == rhs.displayName
            });
        }

        if (newAccessories.length > 0) {
            this.api.registerPlatformAccessories(this.pluginName, this.platformName, newAccessories);
            this.registeredAccessories = this.registeredAccessories.concat(newAccessories);
        }
    }

    public configureAccessory(accessory: HomeBridge.Accessories.PlatformAccessory): void {
        accessory.reachable = false;
        this.registeredAccessories.push(accessory);
    }
    
    public configurationRequestHandler(context: HomeBridge.PlatformContext, request: HomeBridge.ConfigurationRequest, callback: HomeBridge.ConfigurationRequestCallback): void {
    }

    private platformPlugin: PluginType;
    private registeredAccessories: HomeBridge.Accessories.PlatformAccessory[];
    private pluginName: string;
    private platformName: string;
}

function PlatformBuilder<T extends PlatformPlugin>(pluginName: string, platformName: string, ctor: PluginConstructor<T>): HomeBridge.PlatformConstructor {
    const originalConstructor : { new (pluginName: string, platformName: string, pluginConstructor: PluginConstructor<T>, log: HomeBridge.Logger, config: Config.Config, api: HomeBridge.API): Platform<T> } = Platform;
    const modifiedConstructor = originalConstructor.bind(null, pluginName, platformName, ctor);
    return modifiedConstructor;
}

export function register<T extends PlatformPlugin>(pluginName: string, platformName: string, pluginConstructor: PluginConstructor<T>) {
    // For platform plugin to be considered as dynamic platform plugin,
    // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
    return (api: HomeBridge.API) => {
        api.registerPlatform(pluginName, platformName, PlatformBuilder(pluginName, platformName, pluginConstructor), true);
    };
}