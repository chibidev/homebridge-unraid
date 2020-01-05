import { CommandExecutor } from "./commands";
import { Container } from "./models/container";
import { VM } from "./models/vm";
import { map } from "../util/promise";
import { PlatformAccessory } from "homebridge/lib/platformAccessory";
import * as hap from "hap-nodejs";

export namespace PlatformAccessories {
    export class Switch extends PlatformAccessory {
        public constructor(name: string) {
            const uuid = hap.uuid.generate(name);
            super(name, uuid);

            this.on('identify', (_paired, callback) => {
                callback();
            });
            this.addService(hap.Service.Switch, name);
        }

        protected get PrimaryService(): hap.Service {
            return this.getService(hap.Service.Switch);
        }
    }
}

export enum AccessoryProviderType {
    Docker = "docker",
    Libvirt = "libvirt",
}

export interface AccessoryProvider {
    accessories(): Promise<PlatformAccessory[]>;
}

export abstract class CommandAccessoryProvider implements AccessoryProvider {
    public constructor(executor: CommandExecutor) {
        this.executor = executor;
    }

    public abstract accessories(): Promise<PlatformAccessory[]>;

    protected executor: CommandExecutor;
}

class DockerAccessory extends PlatformAccessories.Switch {
    public constructor(container: Container, executor: CommandExecutor) {
        const accessoryName = container.Names[0];
        super(accessoryName);

        const switchService = this.PrimaryService;
        switchService.setCharacteristic(hap.Characteristic.On, container.Status.startsWith("Up"));
        switchService.getCharacteristic(hap.Characteristic.On)?.on(hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
            const command = (value) ? "docker start " + container.Names[0] : "docker stop " + container.Names[0];
            const data = executor.run(command);

            await data.finally(callback);
        });
    }
}

export class DockerAccessoryProvider extends CommandAccessoryProvider {
    public constructor(executor: CommandExecutor) {
        super(executor);
    }

    public async accessories(): Promise<PlatformAccessory[]> {
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
        const accessories = map(containers, (container) => {
            return new DockerAccessory(container, this.executor);
        });

        return accessories;
    }
}

class VMAccessory extends PlatformAccessories.Switch {
    public constructor(vm: VM, executor: CommandExecutor) {
        const accessoryName = vm.Name;
        super(accessoryName);

        const switchService = this.PrimaryService;

        switchService.setCharacteristic(hap.Characteristic.On, vm.State.startsWith("running"));
        switchService.getCharacteristic(hap.Characteristic.On)?.on(hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
            const command = (value) ? "virsh start " + vm.Name : "virsh dompmsuspend " + vm.Name + " disk";
            const data = executor.run(command);

            await data.finally(callback);
        });
    }
}

export class LibvirtAccessoryProvider extends CommandAccessoryProvider {
    async accessories(): Promise<PlatformAccessory[]> {
        // TODO - remove that ugly json transformation
        const result = this.executor.run("virsh list --all --name | while read d; do [[ \"$d\" != \"\" ]] && virsh dominfo \"$d\" | tr -d ' ' | sed -e 's/^/\"/g' -e 's/:/\":\"/g' -e 's/$/\",/g'; done | sed -e 's/\"\"/}/g' -e 's/\"Id/{\"Id/g' -e 's/\"SecurityDOI\":\"\\(.*\\)\",/\"SecurityDOI\":\"\\1\"/g' -e 's/},/}/g' | jq -s");
        const vms = result.then((result) => JSON.parse(result) as VM[]).catch((reason) => {
            // might not be a fatal error, machine could be restarting
            return new Array<VM>();
        });
        const accessories = map(vms, (vm) => {
            return new VMAccessory(vm, this.executor);
        });

        return accessories;
    }
}