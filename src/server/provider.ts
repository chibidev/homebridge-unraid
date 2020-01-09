import { CommandExecutor } from "./commands";
import { PlatformAccessory } from "homebridge/lib/platformAccessory";
import * as hap from "hap-nodejs";
import "../util/promise";

export const PlatformAccessories = {
    Switch: function(name: string) {
        const uuid = hap.uuid.generate(name);
        let accessory = new PlatformAccessory(name, uuid);

        accessory.on("identify", (_paired, callback) => {
            callback();
        });

        let service = accessory.addService(hap.Service.Switch, name);
        return accessory;
    } as any as { new(name: string): PlatformAccessory }
};

export enum AccessoryProviderType {
    Docker = "docker",
    Libvirt = "libvirt",
    Host = "host"
}

export interface AccessoryProvider {
    accessories(): Promise<PlatformAccessory[]>;
    configureAccessory(accessory: PlatformAccessory): void;

    readonly Type: AccessoryProviderType;
}

export abstract class CachingAccessoryProvider implements AccessoryProvider {
    public constructor(type: AccessoryProviderType) {
        this.Type = type;
        this.accessoryCache = {};
    }

    public async accessories(): Promise<PlatformAccessory[]> {
        const accessories = this.queryAccessories();
        return accessories.then((accessories) => {
            this.accessoryCache = accessories.reduce((obj, accessory) => {
                obj[accessory.displayName] = accessory;
                return obj;
            }, {} as { [name: string]: PlatformAccessory });

            return accessories;
        });
    }

    protected abstract queryAccessories(): Promise<PlatformAccessory[]>;
    
    public configureAccessory(accessory: PlatformAccessory): void {
        this.setupAccessory(accessory);
        this.accessoryCache[accessory.displayName] = accessory;
    }

    protected abstract setupAccessory(accessory: PlatformAccessory): void;
    
    protected accessoryCache: { [name: string]: PlatformAccessory };
    public readonly Type: AccessoryProviderType;
}

export abstract class CommandAccessoryProvider extends CachingAccessoryProvider {
    public constructor(type: AccessoryProviderType, executor: CommandExecutor) {
        super(type);
        this.executor = executor;
    }

    protected executor: CommandExecutor;
}