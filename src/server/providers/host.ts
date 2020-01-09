import { PlatformAccessory } from "homebridge/lib/platformAccessory";
import { Config } from "../models/config";
import { CommandAccessoryProvider, AccessoryProviderType, PlatformAccessories } from "../provider";
import { CommandExecutor } from "../commands";
import * as hap from "hap-nodejs";

import ping = require("ping");
import wol = require('wake_on_lan');

export class HostAccessoryProvider extends CommandAccessoryProvider {
    public constructor(executor: CommandExecutor, config: Config.HostConfig) {
        super(AccessoryProviderType.Host, executor);

        this.config = config;
    }

    protected async queryAccessories(): Promise<PlatformAccessory[]> {
        let available = ping.promise.probe(this.config.ip).then((response) => {
            return response.alive;
        });
        let result = available.then((available) => {
            let accessory = Object.values(this.accessoryCache)[0];
            if (!available) {
                if (!accessory)
                    return [];

                const switchService = accessory.services[1];
                switchService.getCharacteristic(hap.Characteristic.On)?.updateValue(false);

                return [accessory];
            }
            let hostname = this.executor.run("hostname");
            let newAccessory = hostname.then((hostname) => {
                if (!accessory || accessory.displayName != hostname) {
                    let newAccessory = new PlatformAccessories.Switch(hostname);
                    this.setupAccessory(newAccessory);

                    const switchService = newAccessory.services[1];
                    switchService.getCharacteristic(hap.Characteristic.On)?.updateValue(available);

                    return [newAccessory];
                } else {
                    const switchService = accessory.services[1];
                    switchService.getCharacteristic(hap.Characteristic.On)?.updateValue(available);

                    return [accessory];
                }
            });
            return newAccessory;
        });

        return result;
    }

    protected setupAccessory(accessory: PlatformAccessory): void {
        const switchService = accessory.services[1];

        switchService.getCharacteristic(hap.Characteristic.On)?.on(hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
            if (!value) {
                let switchOffCommand = "";
                switch (this.config.switchOffMechanism) {
                    case Config.SwitchOffMechanism.ShutDown:
                        switchOffCommand = "shutdown -h now &";
                        break;
                    case Config.SwitchOffMechanism.SuspendToDisk:
                        switchOffCommand = "pm-hibernate &";
                        break;
                    case Config.SwitchOffMechanism.SuspendToRAM:
                        switchOffCommand = "pm-suspend &";
                }
                await this.executor.run(switchOffCommand).finally(callback);
            } else {
                wol.wake(this.config.mac);
                callback();
            }
        });
    }

    private config: Config.HostConfig;
}