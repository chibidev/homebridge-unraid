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
import { Timeout } from "../util/promise";

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

interface HostEvents {
    availabilityUpdated: boolean;
}

interface HostManager extends TypedEventEmitter<HostEvents> {
    available: boolean;

    startMonitoring(): void;
    start(): Promise<void>;
    stop(): Promise<void>;
}

interface ContainerManager {
    containers: ObservableArray<Container>;

    startMonitoring(): void;
    start(container: Container): Promise<void>;
    stop(container: Container): Promise<void>;
}

interface VMManager {
    vms: ObservableArray<VM>;

    startMonitoring(): void;
    start(vm: VM): Promise<void>;
    stop(vm: VM): Promise<void>;
}

class PollingHostManager extends TypedEventEmitter<HostEvents> implements HostManager {
    public available: boolean;

    constructor(executor: CommandExecutor, pollInterval: number, machineIp: string, machineMac: string | undefined, switchOffMechanism: Config.SwitchOffMechanism) {
        super();
        this.commandExecutor = executor;
        this.pollIntervalSeconds = pollInterval;
        this.pollTimer = null;
        this.machineIp = machineIp;
        this.machineMac = machineMac;
        this.switchOffMechanism = switchOffMechanism;
        this.available = false;
    }

    public start() {
        let task = Promise.MakeReady().then(() => {
            if (!this.available && this.machineMac !== undefined)
                wol.wake(this.machineMac);
        });

        return task;
    }

    public stop() {
        let command: string;
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
        let task = this.commandExecutor.run(command).then(async () => {});

        return task;
    }

    public startMonitoring() {
        if (this.pollTimer != null)
            return;

        this.pollTimer = setInterval(() => {
            this.poll();
        }, this.pollIntervalSeconds * 1000);
    }

    private poll() {
        let available = ping.promise.probe(this.machineIp).then((response) => {
            return response.alive;
        });

        available.then((available) => {
            if (this.available != available) {
                this.available = available;
                this.emit("availabilityUpdated", available);
            }
        });
    }

    private commandExecutor: CommandExecutor;
    private pollIntervalSeconds: number;
    private pollTimer: NodeJS.Timeout | null;
    private machineIp: string;
    private machineMac: string | undefined;
    private switchOffMechanism: Config.SwitchOffMechanism;
}

class PollingContainerManager implements ContainerManager {
    public containers: ObservableArray<Container>;

    public constructor(executor: CommandExecutor, pollInterval: number) {
        this.commandExecutor = executor;
        this.pollIntervalSeconds = pollInterval;
        this.pollTimer = null;
        this.containers = new ObservableArray<Container>();
    }

    public start(container: Container) {
        let command = "docker start " + container.Names[0];
        let task = this.commandExecutor.run(command).then(async () => {});

        return task;
    }

    public stop(container: Container) {
        let command = "docker stop " + container.Names[0];
        let task = this.commandExecutor.run(command).then(async () => {});

        return task;
    }

    public startMonitoring() {
        if (this.pollTimer != null)
            return;

        this.pollTimer = setInterval(() => {
            this.poll();
        }, this.pollIntervalSeconds * 1000);
    }

    private poll() {
        this.commandExecutor.run("docker ps --format '{{ json . }}' --all --no-trunc | jq -s '[.[] | .Names |= split(\",\") | .Mounts |= split(\",\") | .Labels |= (split(\",\") | (map( split(\"=\") | { (.[0]) : .[1] } ) | add)) | .Ports |= (split(\",\") | ([.[] | capture(\"(?<ip>[^:]+):(?<hostportrange>[0-9-]+)->(?<containerportrange>[^/]+)/(?<protocol>[a-z]+)\")]))]'").then((output) => JSON.parse(output) as Container[]).then((containers) => {
            return containers.compare(this.containers, (lhs, rhs) => {
                return lhs.Names[0] == rhs.Names[0];
            });
        }).then((containers) => {
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
        }).catch((reason) => {
            // Might not be a fatal error, machine could be restarting. Leave everything at their last known state.
            // We might need to propagate the reason though...
        })
    }

    private commandExecutor: CommandExecutor;
    private pollIntervalSeconds: number;
    private pollTimer: NodeJS.Timeout | null;
}

class PollingVMManager implements VMManager {
    public vms: ObservableArray<VM>;

    public constructor(executor: CommandExecutor, pollInterval: number) {
        this.commandExecutor = executor;
        this.pollIntervalSeconds = pollInterval;
        this.pollTimer = null;
        this.vms = new ObservableArray<VM>();
    }

    public start(vm: VM) {
        let command = "virsh start " + vm.Name;
        let task = this.commandExecutor.run(command).then(async () => {});

        return task;
    }

    public stop(vm: VM) {
        let command = "virsh dompmsuspend " + vm.Name + " disk";
        let task = this.commandExecutor.run(command).then(async () => {});

        return task;
    }

    public startMonitoring() {
        if (this.pollTimer != null)
            return;

        this.pollTimer = setInterval(() => {
            this.poll();
        }, this.pollIntervalSeconds * 1000);
    }

    private poll() {
        this.commandExecutor.run("virsh list --all --name | while read d; do [[ \"$d\" != \"\" ]] && virsh dominfo \"$d\" | tr -d ' ' | sed -e 's/^/\"/g' -e 's/:/\":\"/g' -e 's/$/\",/g'; done | sed -e 's/\"\"/}/g' -e 's/\"Id/{\"Id/g' -e 's/\"SecurityDOI\":\"\\(.*\\)\",/\"SecurityDOI\":\"\\1\"/g' -e 's/},/}/g' | jq -s").then((result) => JSON.parse(result) as VM[]).then((vms) => {
            return vms.compare(this.vms, (lhs, rhs) => {
                return lhs.Name == rhs.Name;
            });
        }).then((vms) => {
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
        }).catch((reason) => {
            // Might not be a fatal error, machine could be restarting. Leave everything at their last known state.
            // We might need to propagate the reason though...
        });
    }

    private commandExecutor: CommandExecutor;
    private pollIntervalSeconds: number;
    private pollTimer: NodeJS.Timeout | null;
}

class Machine extends TypedEventEmitter<MachineEvents> implements ContainerController, VMController, HostController {
    public constructor(config: Const<Config.Machine>) {
        super();

        this.name = config.id;

        this.enableContainers = config.enableContainers;
        this.enableVMs = config.enableVMs;
        this.enableHost = config.host.publish;

        this.autoOnEnabled = config.host.power?.autoOn ?? false;
        this.autoOffEnabled = config.host.power?.autoOff.enabled ?? false;
        this.autoOffDelay = config.host.power?.autoOff.secondsDelay ?? 0;

        switch (config.host.monitor.type) {
            case Config.MonitorType.PollOverSSH:
                let monitor = config.host.monitor as Config.PollOverSSHMonitor;
                let executor = new SSHCommandExecutor(monitor.ip ?? "root@" + config.host.ip);

                this.containerManager = new PollingContainerManager(executor, monitor.interval);
                this.vmManager = new PollingVMManager(executor, monitor.interval);
                this.hostManager = new PollingHostManager(executor, monitor.interval, config.host.ip, config.host.mac, config.host.power?.switchOffMechanism ?? Config.SwitchOffMechanism.SuspendToRAM);

                break;
            default:
                throw new Error("Invalid configuration for command execution");
        }

        this.containerManager.containers.on("delete", () => {
            this.startAutoOffTimerIfNecessary();
        });

        this.containerManager.containers.on("new", () => {
            this.cancelAutoOffTimerIfNecessary();
        });

        this.vmManager.vms.on("delete", () => {
            this.startAutoOffTimerIfNecessary();
        });

        this.vmManager.vms.on("new", () => {
            this.cancelAutoOffTimerIfNecessary();
        });

        this.hostManager.on("availabilityUpdated", (available) => {
            if (this.available != available) {
                this.available = available;
                this.emit("availabilityUpdated", available);
            }
        });
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
        if (object === undefined)
            return this.hostManager.start();       

        let task: Promise<void> = Promise.MakeReady();
        if (this.autoOnEnabled && !this.available) {
            task = this.start().then(async () => {
                while (!this.available) {
                    await Promise.Delay(500);
                }
                return Promise.Delay(5000);
            });
        }

        task = task.then(async () => {
            if (object instanceof Container)
                return this.containerManager.start(object);
            else
                return this.vmManager.start(object);
        });

        return task;
    }

    public async stop(): Promise<void>;
    public async stop(container: Container): Promise<void>;
    public async stop(vm: VM): Promise<void>;
    public async stop(object?: Container | VM): Promise<void> {
        let task: Promise<void>;
        if (object === undefined)
            task = this.hostManager.stop();
        else if (object instanceof Container)
            task = this.containerManager.stop(object);
        else
            task = this.vmManager.stop(object);

        if (object !== undefined)
            this.startAutoOffTimerIfNecessary();

        return task;
    }

    public readonly name: string;
    public get containers() {
        return this.containerManager.containers;
    }

    public get vms() {
        return this.vmManager.vms;
    }

    public available: boolean;

    public startMonitoring() {
        this.containerManager.startMonitoring();
        this.vmManager.startMonitoring();
        this.hostManager.startMonitoring();
    }

    private startAutoOffTimerIfNecessary(): void {
        if (!this.autoOffEnabled)
            return;

        if (!this.anyServiceRunning() && this.autoOffTask == null) {
            this.autoOffTask = Promise.Delay(this.autoOffDelay * 1000);
            this.autoOffTask.then(() => {
                if (!this.anyServiceRunning())
                    this.stop();
                this.autoOffTask = null;
            });
        }
    }

    private cancelAutoOffTimerIfNecessary(): void {
        if (!this.autoOffEnabled)
            return;

        if (this.autoOffTask !== null) {
            this.autoOffTask.cancel();
            this.autoOffTask = null;
        }
    }

    private anyServiceRunning(): boolean {
        return !this.containers.filter((container) => container.IsRunning).empty() || !this.vms.filter((vm) => vm.IsRunning).empty();
    }

    private enableContainers: boolean;
    private enableVMs: boolean;
    private enableHost: boolean;

    public autoOnEnabled: boolean;
    private autoOffEnabled: boolean;
    private autoOffDelay: number;
    private autoOffTask: Timeout | null;

    private vmManager: VMManager;
    private containerManager: ContainerManager;
    private hostManager: HostManager;

}