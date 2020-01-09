import { PlatformAccessory } from "homebridge/lib/platformAccessory";
import { CommandAccessoryProvider, AccessoryProviderType, PlatformAccessories } from "../provider";
import { CommandExecutor } from "../commands";
import { Container } from "../models/container";
import * as hap from "hap-nodejs";
import "../../util/promise";

export class DockerAccessoryProvider extends CommandAccessoryProvider {
    public constructor(executor: CommandExecutor) {
        super(AccessoryProviderType.Docker, executor);
    }

    protected async queryAccessories(): Promise<PlatformAccessory[]> {
        // TODO - Command composition
        // Creating a command descriptor and then composing the command + the jq part would be much more readable
        // Something like this:
        // let jqCommand = JQ | DecomposeArray | ModifyField('Names', SplitBy(',')) | ... | ComposeArray;
        // let dockerCommand = Docker.CurrentContainers | AddOption('format', '{{ json . }}') | AddOption('--all') | ...;
        // let commandToRun = dockerCommand | jqCommand;
        //
        // Docker command might look like this
        // let dockerCommand = Docker.CurrentContainers.jsonOutput().allContainers()...;
        //
        // Of course TS does not support operator overloading, so this is gonna be very explicit. Need to find a good syntax.
        const result = this.executor.run("docker ps --format '{{ json . }}' --all --no-trunc | jq -s '[.[] | .Names |= split(\",\") | .Mounts |= split(\",\") | .Labels |= (split(\",\") | (map( split(\"=\") | { (.[0]) : .[1] } ) | add)) | .Ports |= (split(\",\") | ([.[] | capture(\"(?<ip>[^:]+):(?<hostportrange>[0-9-]+)->(?<containerportrange>[^/]+)/(?<protocol>[a-z]+)\")]))]'");
        const containers = result.then((output) => JSON.parse(output) as Container[]).catch((reason) => {
            // Might not be a fatal error, machine could be restarting.
            // We might need to propagate the reason though...
            return new Array<Container>();
        });
        const accessories = containers.map((container) => {
            let accessory = this.accessoryCache[container.Names[0]];

            if (!accessory) {
                accessory = new PlatformAccessories.Switch(container.Names[0]);
                this.setupAccessory(accessory);
            }
            const switchService = accessory.services[1];
            switchService.getCharacteristic(hap.Characteristic.On)?.updateValue(container.Status.startsWith("Up"));

            return accessory;
        });

        return accessories;
    }

    protected setupAccessory(accessory: PlatformAccessory): void {
        const switchService = accessory.services[1];
            
        let name = accessory.displayName;
        switchService.getCharacteristic(hap.Characteristic.On)?.on(hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
            const command = (value) ? "docker start " + name : "docker stop " + name;
            const data = this.executor.run(command);

            await data.finally(callback);
        });
    }
}
