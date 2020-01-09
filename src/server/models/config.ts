import { HomeBridge } from '../../lib/homebridge';
import { compose } from "../../util/functional";

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
    
        export interface Config extends HomeBridge.Config {
            machines: Machine[];
            providers: AccessoryProviderType[];
            ip: string;
            updateInterval: number;
        }

        export const VersionNumber = 0;
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

        export interface Config extends HomeBridge.Config {
            machines: Machine[];
            updateInterval: number;
        }

        export const VersionNumber = v1.VersionNumber + 1;

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
        export import AccessoryProviderType = v2.AccessoryProviderType;

        export enum SwitchOffMechanism {
            ShutDown = "shutdown",
            SuspendToRAM = "suspend",
            SuspendToDisk = "hibernate"
        }

        export interface HostConfig {
            publish: boolean;
            switchOffMechanism: SwitchOffMechanism;
            mac: string;
            ip: string;
        }

        export interface Machine {
            id: string;
            address: Address;
            enableContainers: boolean;
            enableVMs: boolean;
            host: HostConfig;
        }

        export interface Config extends HomeBridge.Config {
            machines: Machine[];
            updateInterval: number;
        }

        export const VersionNumber = v2.VersionNumber + 1;

        export function migrate(config: v2.Config): v3.Config {
            let v3Machines = config.machines.map((v2Machine) => {
                let v3Machine = {
                    id: v2Machine.id,
                    address: v2Machine.address,
                    enableContainers: v2Machine.providers.includes(AccessoryProviderType.Docker),
                    enableVMs: v2Machine.providers.includes(AccessoryProviderType.Libvirt),
                    host: {
                        publish: false,
                        switchOffMechanism: SwitchOffMechanism.SuspendToRAM
                    } as HostConfig
                } as Machine;
                return v3Machine;
            });
            let v3Config = {
                machines: v3Machines,
                updateInterval: config.updateInterval
            } as Config;

            return v3Config;
        }
    }

    export function configVersion(config: HomeBridge.Config): number {
        let v1Config = config as v1.Config;
        if (v1Config.providers)
            return v1.VersionNumber;

        let v2Config = config as v2.Config;
        if (v2Config.machines.length > 0)
            if (v2Config.machines[0].providers)
                return v2.VersionNumber;

        return currentVersionNumber;
    }

    const migrationSequence = [v2.migrate, v3.migrate];
    const currentVersionNumber = v3.VersionNumber;

    export function migrate(config: HomeBridge.Config) {
        let version = configVersion(config)
        if (version == currentVersionNumber)
            return config as Config;
        const seq = migrationSequence.slice(version, currentVersionNumber);

        let migrationFunction = compose(seq);
        let newConfig = migrationFunction(config) as Config;

        return newConfig;
    }

    export import AddressType = v3.AddressType;
    export type Address = v3.Address;
    export type SSHParams = v3.SSHParams;
    export type SSHAddress = v3.SSHAddress;
    export import AccessoryProviderType = v3.AccessoryProviderType;
    export import SwitchOffMechanism = v3.SwitchOffMechanism;
    export type HostConfig = v3.HostConfig;
    export type Machine = v3.Machine;
    export type Config = v3.Config;
}