import { Config } from "./models/config";
import { CommandExecutor, SSHCommandExecutor } from "./commands";
import "../util/promise";

import ping = require("ping");
import wol = require('wake_on_lan');

import { ObservableArray } from "../util/reactive";
import { Container } from "./models/container";
import { VM } from "./models/vm";

import "../util/iterable";
import { map } from "../util/map";
import { TypedEventEmitter } from "../util/events";
import { Const } from "../util/types";

interface MachineEvents {
    availabilityUpdated: boolean;
    nameUpdated: string;
}

interface BaseController extends TypedEventEmitter<MachineEvents> {
    name: string;
    available: boolean;
    autoOnEnabled: boolean;

    controlsHost(): this is HostController;
    controlsContainers(): this is ContainerController;
    controlsVMs(): this is VMController;
    startMonitoring(): void;
}

export interface ContainerController extends BaseController {
    containers: ObservableArray<Container>;

    start(container: Container): Promise<void>;
    stop(Container: Container): Promise<void>;
}

export interface VMController extends BaseController {
    vms: ObservableArray<VM>;

    start(vm: VM): Promise<void>
    stop(vm: VM): Promise<void>;
}

export interface HostController extends BaseController {
    start(): Promise<void>;
    stop(): Promise<void>;
}

export type MachineController = ContainerController | VMController | HostController;

export namespace MachineController {
    export function CreateFromConfig(config: Const<Config.Machine>): MachineController {
        return new Machine(config);
    }
}

class Machine extends TypedEventEmitter<MachineEvents> implements ContainerController, VMController, HostController {
    public constructor(config: Const<Config.Machine>) {
        super();

        this.name = config.id;
        this.containers = new ObservableArray<Container>();
        this.vms = new ObservableArray<VM>();
        this.available = false;

        this.ip = config.host.ip;
        this.mac = config.host.mac;

        this.pollTimer = null;

        this.enableContainers = config.enableContainers;
        this.enableVMs = config.enableVMs;
        this.enableHost = config.host.publish;

        this.autoOnEnabled = config.host.power?.autoOn ?? false;
        this.autoOffEnabled = config.host.power?.autoOff.enabled ?? false;
        this.autoOffDelay = config.host.power?.autoOff.secondsDelay ?? 0;

        this.switchOffMechanism = config.host.power?.switchOffMechanism ?? Config.SwitchOffMechanism.SuspendToRAM;

        switch (config.host.monitor.type) {
            case Config.MonitorType.PollOverSSH:
                let monitor = config.host.monitor as Config.PollOverSSHMonitor;
                this.commandExecutor = new SSHCommandExecutor(monitor.ip ?? "root@" + config.host.ip);
                this.pollInterval = monitor.interval;

                break;
            default:
                throw new Error("Invalid configuration for command execution");
        }
    }

    public controlsContainers(): this is ContainerController {
        return this.enableContainers;
    }

    public controlsVMs(): this is VMController {
        return this.enableVMs;
    }

    public controlsHost(): this is HostController {
        return this.enableHost;
    }

    public async start(): Promise<void>;
    public async start(container: Container): Promise<void>;
    public async start(vm: VM): Promise<void>;
    public async start(object?: Container | VM): Promise<void> {
        if (object === undefined) {
            if (!this.available && this.mac !== undefined)
                wol.wake(this.mac);
            return;
        }

        let command: string;
        if (object instanceof Container)
            command = "docker start " + object.Names[0];
        else
            command = "virsh start " + object.Name;

        let task: Promise<void> = Promise.MakeReady();
        if (this.autoOnEnabled && !this.available) {
            task = this.start();
            task = task.then(async () => {
                return Promise.Delay(5000);
            });
        }

        task = task.then(async () => {
            return this.commandExecutor.run(command).then(() => {})
        });

        return task;
    }

    public async stop(): Promise<void>;
    public async stop(container: Container): Promise<void>;
    public async stop(vm: VM): Promise<void>;
    public async stop(object?: Container | VM): Promise<void> {
        let command;
        if (object === undefined) {
            switch (this.switchOffMechanism) {
                case Config.SwitchOffMechanism.ShutDown:
                    command = "shutdown -h now &";
                    break;
                case Config.SwitchOffMechanism.SuspendToDisk:
                    command = "pm-hibernate &";
                    break;
                case Config.SwitchOffMechanism.SuspendToRAM:
                    command = "pm-suspend &";
                    break;
            }
        } else if (object instanceof Container) {
            command = "docker stop " + object.Names[0];
        } else {
            command = "virsh dompmsuspend " + object.Name + " disk";
        }

        if (object !== undefined && this.autoOffEnabled) {
            Promise.Delay(this.autoOffDelay * 1000).then(() => {
                if (this.containers.filter((container) => container.IsRunning).empty() && this.vms.filter((vm) => vm.IsRunning).empty())
                    this.stop();
            });
        }

        return this.commandExecutor.run(command).then();
    }

    public readonly name: string;
    public containers: ObservableArray<Container>;
    public vms: ObservableArray<VM>;
    public available: boolean;

    public startMonitoring() {
        if (this.pollTimer != null)
            return;

        this.pollTimer = setInterval(() => {
            this.poll();
        }, this.pollInterval * 1000);
    }

    private poll() {
        let available = ping.promise.probe(this.ip).then((response) => {
            return response.alive;
        });
        available.then((available) => {
            if (this.available != available) {
                this.available = available;
                this.emit("availabilityUpdated", available);
            }
            
            if (!available) {
                // Leave VMs and containers in the last state they were observed.
                return;
            }

            const containers = this.commandExecutor.run("docker ps --format '{{ json . }}' --all --no-trunc | jq -s '[.[] | .Names |= split(\",\") | .Mounts |= split(\",\") | .Labels |= (split(\",\") | (map( split(\"=\") | { (.[0]) : .[1] } ) | add)) | .Ports |= (split(\",\") | ([.[] | capture(\"(?<ip>[^:]+):(?<hostportrange>[0-9-]+)->(?<containerportrange>[^/]+)/(?<protocol>[a-z]+)\")]))]'").then((output) => JSON.parse(output) as Container[]).catch((reason) => {
                // Might not be a fatal error, machine could be restarting.
                // We might need to propagate the reason though...
                return new Array<Container>();
            }).then((containers) => {
                return containers.compare(this.containers, (lhs, rhs) => {
                    return lhs.Names[0] == rhs.Names[0];
                });
            });
            
            containers.then((containers) => {
                let newContainers = containers.new.map((container) => {
                    return map(container).to(Container);
                });
                this.containers.push(...newContainers);
                
                containers.deleted.forEach((container) => {
                    this.containers.remove(container);
                });
                
                containers.intersection.forEach((container) => {
                    let realContainer = this.containers.find((c) => {
                        return c.Names[0] == container.Names[0];
                    });
                    
                    if (realContainer !== undefined)
                        realContainer.Status = container.Status;
                });
            });
            
            const vms = this.commandExecutor.run("virsh list --all --name | while read d; do [[ \"$d\" != \"\" ]] && virsh dominfo \"$d\" | tr -d ' ' | sed -e 's/^/\"/g' -e 's/:/\":\"/g' -e 's/$/\",/g'; done | sed -e 's/\"\"/}/g' -e 's/\"Id/{\"Id/g' -e 's/\"SecurityDOI\":\"\\(.*\\)\",/\"SecurityDOI\":\"\\1\"/g' -e 's/},/}/g' | jq -s").then((result) => JSON.parse(result) as VM[]).catch((reason) => {
                // might not be a fatal error, machine could be restarting
                return new Array<VM>();
            }).then((vms) => {
                return vms.compare(this.vms, (lhs, rhs) => {
                    return lhs.Name == rhs.Name;
                });
            });

            vms.then((vms) => {
                let newVMs = vms.new.map((vm) => {
                    return map(vm).to(VM);
                });
                this.vms.push(...newVMs);
                
                vms.deleted.forEach((vm) => {
                    this.vms.remove(vm);
                });
                
                vms.intersection.forEach((vm) => {
                    let realVM = this.vms.find((v) => {
                        return v.Name == vm.Name;
                    });

                    if (realVM !== undefined)
                        realVM.State = vm.State;
                });
            });
        });
    }
    
    private commandExecutor: CommandExecutor;
    private pollTimer: NodeJS.Timeout | null;
    private ip: string;
    private mac: string | undefined;
    private pollInterval: number;

    private enableContainers: boolean;
    private enableVMs: boolean;
    private enableHost: boolean;

    public autoOnEnabled: boolean;
    private autoOffEnabled: boolean;
    private autoOffDelay: number;
    private switchOffMechanism: Config.SwitchOffMechanism;
}