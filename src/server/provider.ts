import { CommandExecutor } from "./commands";
import { Container } from "./models/container";
import { VM } from "./models/vm";
import { PlatformAccessory } from "homebridge/lib/platformAccessory";
import * as hap from "hap-nodejs";
import "../util/promise";

const PlatformAccessories = {
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
            accessories.forEach((accessory) => {
                let cachedAccessory = this.accessoryCache[accessory.displayName];
                if (!cachedAccessory)
                    this.accessoryCache[accessory.displayName] = accessory;
            });
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

export class LibvirtAccessoryProvider extends CommandAccessoryProvider {
    public constructor(executor: CommandExecutor) {
        super(AccessoryProviderType.Libvirt, executor);
    }

    protected async queryAccessories(): Promise<PlatformAccessory[]> {
        // TODO - remove that ugly json transformation
        const result = this.executor.run("virsh list --all --name | while read d; do [[ \"$d\" != \"\" ]] && virsh dominfo \"$d\" | tr -d ' ' | sed -e 's/^/\"/g' -e 's/:/\":\"/g' -e 's/$/\",/g'; done | sed -e 's/\"\"/}/g' -e 's/\"Id/{\"Id/g' -e 's/\"SecurityDOI\":\"\\(.*\\)\",/\"SecurityDOI\":\"\\1\"/g' -e 's/},/}/g' | jq -s");
        const vms = result.then((result) => JSON.parse(result) as VM[]).catch((reason) => {
            // might not be a fatal error, machine could be restarting
            return new Array<VM>();
        });

        const accessories = vms.map((vm) => {
            let accessory = this.accessoryCache[vm.Name];
            if (!accessory) {
                accessory = new PlatformAccessories.Switch(vm.Name);
                this.setupAccessory(accessory);
            }

            const switchService = accessory.services[1];
            switchService.getCharacteristic(hap.Characteristic.On)?.updateValue(vm.State.startsWith("running"));

            return accessory;
        });

        return accessories;
    }

    protected setupAccessory(accessory: PlatformAccessory): void {
        const switchService = accessory.services[1];
            
        let name = accessory.displayName;
        switchService.getCharacteristic(hap.Characteristic.On)?.on(hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
            const command = (value) ? "virsh start " + name : "virsh dompmsuspend " + name + " disk";
            const data = this.executor.run(command);

            await data.finally(callback);
        });
    }
}