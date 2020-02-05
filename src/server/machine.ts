import { Config } from "./models/config";
import { CommandExecutor, SSHCommandExecutor } from "./commands";
import * as Providers from "./provider";
import { PlatformAccessory } from "homebridge/lib/platformAccessory";
import "../util/promise";

import { DockerAccessoryProvider } from "./providers/docker";
import { HostAccessoryProvider } from "./providers/host";
import { LibvirtAccessoryProvider } from "./providers/libvirt";

export class Machine {
    public constructor(config: Config.Machine) {
        this.Id = config.id;
        this.providers = [];

        let commandExecutor: CommandExecutor;
        switch (config.address.type) {
            case Config.AddressType.SSH:
                const sshConfig = config.address as Config.SSHAddress;
                commandExecutor = new SSHCommandExecutor(sshConfig.params.ip);
                break;
            default:
                throw new Error("Invalid configuration for command execution");
        }

        if (config.enableContainers)
            this.providers.push(new DockerAccessoryProvider(commandExecutor));
        if (config.enableVMs)
            this.providers.push(new LibvirtAccessoryProvider(commandExecutor));
        if (config.host.publish)
            this.providers.push(new HostAccessoryProvider(commandExecutor, config.host));
    }

    public async accessories(): Promise<PlatformAccessory[]> {
        const accessories = Promise.all(this.providers.map((provider) => {
            return provider.accessories().map((accessory) => {
                accessory.context = {
                    owner: {
                        machine: this.Id,
                        provider: provider.Type
                    }
                };
                return accessory;
            });
        })).flat();

        return accessories;
    }

    public configureAccessory(accessory: PlatformAccessory): boolean {
        const ownerType = accessory.context.owner.provider;
        if (!ownerType)
            return false;

        const owner = this.providers.find((provider) => {
            return provider.Type == ownerType;
        });

        if (!owner)
            accessory.reachable = false;
        else
            owner.configureAccessory(accessory);

        return true;
    }

    public readonly Id: string;
    private providers: Providers.AccessoryProvider[];
}