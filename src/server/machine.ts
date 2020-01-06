import { Config } from "./models/config";
import { CommandExecutor, SSHCommandExecutor } from "./commands";
import * as Providers from "./provider";
import { PlatformAccessory } from "homebridge/lib/platformAccessory";
import "../util/promise";

export class Machine {
    public constructor(config: Config.Machine) {
        this.Id = config.id;

        let commandExecutor: CommandExecutor;
        switch (config.address.type) {
            case Config.AddressType.SSH:
                    const sshConfig = config.address as Config.SSHAddress;
                    commandExecutor = new SSHCommandExecutor(sshConfig.params.ip);
                    break;
            default:
                    throw new Error("Invalid configuration for command execution");
        }

        this.providers = config.providers.map((value) => {
            switch (value) {
                case Providers.AccessoryProviderType.Docker:
                    return new Providers.DockerAccessoryProvider(commandExecutor);
                case Providers.AccessoryProviderType.Libvirt:
                    return new Providers.LibvirtAccessoryProvider(commandExecutor);
            }
        });
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