import { HomeBridge } from "../lib/homebridge";
import { CommandExecutor } from "./commands";
import { Container } from "./container";
import { VM } from "./vm";
import { map } from "../util/promise";

export enum AccessoryProviderType {
    Docker = "docker",
    Libvirt = "libvirt",
}

export interface AccessoryProvider {
    accessories(context: HomeBridge.Accessories.Context): Promise<HomeBridge.Accessories.PlatformAccessory[]>;
}

export abstract class CommandAccessoryProvider implements AccessoryProvider {
    public constructor(executor: CommandExecutor) {
        this.executor = executor;
    }

    public abstract accessories(context: HomeBridge.Accessories.Context): Promise<HomeBridge.Accessories.PlatformAccessory[]>;

    protected executor: CommandExecutor;
}

export class DockerAccessoryProvider extends CommandAccessoryProvider {
    public constructor(executor: CommandExecutor) {
        super(executor);
    }

    public async accessories(context: HomeBridge.Accessories.Context): Promise<HomeBridge.Accessories.PlatformAccessory[]> {
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
        // Of course TS does not support operator overloading, so this is gonna be very explicit.
        const result = this.executor.run("docker ps --format '{{ json . }}' --all --no-trunc | jq -s '[.[] | .Names |= split(\",\") | .Mounts |= split(\",\") | .Labels |= (split(\",\") | (map( split(\"=\") | { (.[0]) : .[1] } ) | add)) | .Ports |= (split(\",\") | ([.[] | capture(\"(?<ip>[^:]+):(?<hostportrange>[0-9-]+)->(?<containerportrange>[^/]+)/(?<protocol>[a-z]+)\")]))]'");
        const containers = result.then((output) => JSON.parse(output) as Container[]).catch((reason) => {
            // Might not be a fatal error, machine could be restarting.
            // We might need to propagate the reason though...
            return new Array<Container>();
        });
        const accessories = map(containers, (container) => {
            const accessoryName = container.Names[0];
            const status = (container.Status.startsWith("Up")) ? HomeBridge.Accessories.Status.On : HomeBridge.Accessories.Status.Off;
            const newAccessory = context.createSwitch(accessoryName, status, async (value: boolean, callback: any) => {
                const command = (value) ? "docker start " + container.Names : "docker stop " + container.Names;
                const data = this.executor.run(command);

                await data.finally(callback);
            });
            
            return newAccessory;
        });

        return accessories;
    }
}

export class LibvirtAccessoryProvider extends CommandAccessoryProvider {
    async accessories(context: HomeBridge.Accessories.Context): Promise<HomeBridge.Accessories.PlatformAccessory[]> {
        // TODO - remove that ugly json transformation
        const result = this.executor.run("virsh list --all --name | while read d; do [[ \"$d\" != \"\" ]] && virsh dominfo \"$d\" | tr -d ' ' | sed -e 's/^/\"/g' -e 's/:/\":\"/g' -e 's/$/\",/g'; done | sed -e 's/\"\"/}/g' -e 's/\"Id/{\"Id/g' -e 's/\"SecurityDOI\":\"\\(.*\\)\",/\"SecurityDOI\":\"\\1\"/g' -e 's/},/}/g' | jq -s");
        const vms = result.then((result) => JSON.parse(result) as VM[]).catch((reason) => {
            // might not be a fatal error, machine could be restarting
            return new Array<VM>();
        });
        const accessories = map(vms, (vm) => {
            const accessoryName = vm.Name;
            const status = (vm.State.startsWith("running")) ? HomeBridge.Accessories.Status.On : HomeBridge.Accessories.Status.Off;
            const newAccessory = context.createSwitch(accessoryName, status, async (value: boolean, callback: any) => {
                const command = (value) ? "virsh start " + vm.Name : "virsh dompmsuspend " + vm.Name + " disk";
                const data = this.executor.run(command);

                await data.finally(callback);
            });

            return newAccessory;
        });

        return accessories;
    }
}