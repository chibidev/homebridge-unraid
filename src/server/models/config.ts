import * as HomeBridge from '../../lib/homebridge';

export namespace Config {
    namespace v1 {
        export enum AddressType {
            SSH = "ssh",
        }
    
        export interface Address {
            type: AddressType;
            params: any;
        }
    
        export interface SSHParams {
            ip: string;
        }
    
        export interface SSHAddress extends Address {
            params: SSHParams;
        }

        export enum AccessoryProviderType {
            Libvirt = "libvirt",
            Docker = "docker"
        }
    
        export interface Machine {
            address: Address;
            providers: AccessoryProviderType[];
        }
    
        export interface Config extends HomeBridge.Config.Config {
            machines: Machine[];
            providers: AccessoryProviderType[];
            ip: string;
            updateInterval: number;
        }

        export const VersionIdentifier = HomeBridge.Config.InitialConfigVersionIdentifier;
    }

    namespace v2 {
        export import AddressType = v1.AddressType;
        export type Address = v1.Address;
        export type SSHParams = v1.SSHParams;
        export type SSHAddress = v1.SSHAddress;
        export import AccessoryProviderType = v1.AccessoryProviderType;

        export interface Machine {
            id: string;
            address: Address;
            providers: AccessoryProviderType[];
        }

        export interface Config extends HomeBridge.Config.Config {
            machines: Machine[];
            updateInterval: number;
        }

        export const VersionIdentifier = HomeBridge.Config.NextVersion(v1.VersionIdentifier);

        export function migrate(config: v1.Config): v2.Config {
            let v2Machines = config.machines.map((v1Machine) => {
                let v2Machine = {
                    id: v1Machine.address.params.ip, // definitely works as the only address type is SSH
                    address: v1Machine.address,
                    providers: v1Machine.providers
                } as Machine;

                return v2Machine;
            });
            let v2Config = {
                machines: v2Machines,
                updateInterval: config.updateInterval
            } as Config;

            return v2Config;
        }
    }

    namespace v3 {
        export import AddressType = v2.AddressType;
        export type Address = v2.Address;
        export type SSHParams = v2.SSHParams;
        export type SSHAddress = v2.SSHAddress;

        export enum SwitchOffMechanism {
            ShutDown = "shutdown",
            SuspendToRAM = "suspend",
            SuspendToDisk = "hibernate"
        }

        export interface HostConfig {
            publish: boolean;
            switchOffMechanism?: SwitchOffMechanism;
            ip: string;
            mac?: string;
        }

        export interface Machine {
            id: string;
            address: Address;
            enableContainers: boolean;
            enableVMs: boolean;
            host: HostConfig;
        }

        export interface Config extends HomeBridge.Config.Config {
            machines: Machine[];
            updateInterval: number;
        }

        export const VersionIdentifier = HomeBridge.Config.NextVersion(v2.VersionIdentifier);

        export function migrate(config: v2.Config): v3.Config {
            const v3Machines = config.machines.map((v2Machine) => {
                const v3Machine: Machine = {
                    id: v2Machine.id,
                    address: v2Machine.address,
                    enableContainers: v2Machine.providers.includes(v2.AccessoryProviderType.Docker),
                    enableVMs: v2Machine.providers.includes(v2.AccessoryProviderType.Libvirt),
                    host: {
                        publish: false,
                        ip: ""
                    }
                };
                return v3Machine;
            });
            const v3Config: Config = {
                machines: v3Machines,
                updateInterval: config.updateInterval
            };

            return v3Config;
        }

        export const DefaultConfig: Config = {
            machines: [],
            updateInterval: 15
        };
    }

    namespace v4 {
        export import SwitchOffMechanism = v3.SwitchOffMechanism;

        export enum MonitorType {
            PollOverSSH = "ssh+poll"
        }

        export interface Monitor {
            type: MonitorType;
        }

        export interface PollMonitor extends Monitor {
            interval: number;
        }

        export interface SSHMonitor extends Monitor {
            ip?: string;
            port?: number;
        }

        export interface PollOverSSHMonitor extends PollMonitor, SSHMonitor {
        }

        export interface HostConfig {
            monitor: Monitor;
            publish: boolean;
            ip: string;
            mac?: string;
            switchOffMechanism?: SwitchOffMechanism;
        }

        export interface Machine {
            id: string;
            enableContainers: boolean;
            enableVMs: boolean;
            host: HostConfig;
        }

        export interface Config extends HomeBridge.Config.Config {
            machines: Machine[];
        }

        export function migrate(config: v3.Config): v4.Config {
            let pollTime = config.updateInterval;

            let v4Machines = config.machines.map((machine) => {
                const monitor: PollOverSSHMonitor = {
                    type: MonitorType.PollOverSSH,
                    interval: pollTime,
                    ip: (machine.address.params as v3.SSHParams).ip
                };

                const hostConfig: HostConfig = {
                    monitor: monitor,
                    publish: machine.host.publish,
                    ip: machine.host.ip,
                    mac: machine.host.mac,
                    switchOffMechanism: machine.host.switchOffMechanism,
                }

                const v4Machine: Machine = {
                    id: machine.id,
                    enableContainers: machine.enableContainers,
                    enableVMs: machine.enableVMs,
                    host: hostConfig
                };

                return v4Machine;
            });

            const v4Config: v4.Config = {
                machines: v4Machines
            };

            return v4Config;
        }

        export const DefaultConfig: Config = {
            machines: []
        };

        export const VersionIdentifier = HomeBridge.Config.NextVersion(v3.VersionIdentifier);
    }

    namespace v5 {
        export import SwitchOffMechanism = v4.SwitchOffMechanism;
        export import MonitorType = v4.MonitorType;
        export type Monitor = v4.Monitor;
        export type PollMonitor = v4.PollMonitor;
        export type SSHMonitor = v4.SSHMonitor;
        export type PollOverSSHMonitor = v4.PollOverSSHMonitor;

        export interface AutoOffConfig {
            enabled: boolean;
            secondsDelay?: number;
        }

        export interface PowerConfig {
            autoOn: boolean;
            autoOff: AutoOffConfig;
            switchOffMechanism?: SwitchOffMechanism;
        }

        export interface HostConfig {
            monitor: Monitor;
            publish: boolean;
            ip: string;
            mac?: string;
            power?: PowerConfig;
        }

        export interface Machine {
            id: string;
            enableContainers: boolean;
            enableVMs: boolean;
            host: HostConfig;
        }

        export interface Config extends HomeBridge.Config.Config {
            machines: Machine[];
        }

        export function migrate(config: v4.Config): v5.Config {
            let v5Machines = config.machines.map((machine) => {
                const autoOffConfig: AutoOffConfig = {
                    enabled: false
                };

                const powerConfig: PowerConfig = {
                    autoOn: false,
                    autoOff: autoOffConfig,
                    switchOffMechanism: machine.host.switchOffMechanism
                };

                const hostConfig: HostConfig = {
                    monitor: machine.host.monitor,
                    publish: machine.host.publish,
                    ip: machine.host.ip,
                    mac: machine.host.mac,
                    power: powerConfig
                }

                const v5Machine: Machine = {
                    id: machine.id,
                    enableContainers: machine.enableContainers,
                    enableVMs: machine.enableVMs,
                    host: hostConfig
                };

                return v5Machine;
            });

            let v5Config: Config = {
                machines: v5Machines
            };

            return v5Config;
        }

        export const DefaultConfig: Config = {
            machines: []
        };

        export const VersionIdentifier = HomeBridge.Config.NextVersion(v4.VersionIdentifier);
    }

    function version(config: HomeBridge.Config.Config): HomeBridge.Config.Version {
        let v1Config = config as v1.Config;
        if (v1Config.providers)
            return v1.VersionIdentifier;

        let v2Config = config as v2.Config;
        if (v2Config.machines.length > 0)
            if (v2Config.machines[0].providers !== undefined)
                return v2.VersionIdentifier;

        let v3Config = config as v3.Config;
        if (v3Config.updateInterval !== undefined)
            return v3.VersionIdentifier;

        let v4Config = config as v4.Config;
        if (v4Config.machines.length > 0)
            if (v4Config.machines[0].host.switchOffMechanism !== undefined)
                return v4.VersionIdentifier;

        return currentVersion;
    }

    const defaultConfig = v5.DefaultConfig;
    const migrationSequence = [v5.migrate, v4.migrate, v3.migrate, v2.migrate];
    const currentVersion = v5.VersionIdentifier;

    export const Traits = {
        defaultConfig: defaultConfig,
        versionFunction: version,
        currentVersionIdentifier: currentVersion,
        migrationSequence: migrationSequence
    }

    export import SwitchOffMechanism = v5.SwitchOffMechanism;
    export import MonitorType = v5.MonitorType;
    export type Monitor = v5.Monitor;
    export type PollMonitor = v5.PollMonitor;
    export type SSHMonitor = v5.SSHMonitor;
    export type PollOverSSHMonitor = v5.PollOverSSHMonitor;
    export type AutoOffConfig = v5.AutoOffConfig;
    export type PowerConfig = v5.PowerConfig;
    export type HostConfig = v5.HostConfig;
    export type Machine = v5.Machine;
    export type Config = v5.Config;
}