import { Config } from "./models/config";
import { CommandExecutor, SSHCommandExecutor } from "./commands";
import { HomeBridge } from "../lib/homebridge";
import * as Providers from "./provider";
import { PlatformAccessory } from "homebridge/lib/platformAccessory";
import "../util/promise";

export class Machine {
    public constructor(config: Config.Machine) {
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
            return provider.accessories();
        })).flat();

        return accessories;
    }

    private providers: Providers.AccessoryProvider[];
}