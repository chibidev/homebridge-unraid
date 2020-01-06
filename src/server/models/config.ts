import { HomeBridge } from '../../lib/homebridge';
import { AccessoryProviderType } from "../provider";
import { compose } from "../../util/functional";

export namespace Config {
    export namespace v1 {
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
    }

    export namespace v2 {
        export interface Machine {
            id: string;
            address: Address;
            providers: AccessoryProviderType[];
        }

        export interface Config extends HomeBridge.Config {
            machines: Machine[];
            updateInterval: number;
        }

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

    export function configVersion(config: HomeBridge.Config): number {
        if ("providers" in config)
            return 0;
        return currentVersionNumber;
    }

    export const migrationSequence = [v2.migrate];
    export const currentVersionNumber = 1;

    export function migrate(config: HomeBridge.Config) {
        let version = configVersion(config)
        if (version == currentVersionNumber)
            return config as Config;
        const seq = migrationSequence.slice(version, currentVersionNumber);

        let migrationFunction = compose(seq);
        let newConfig = migrationFunction(config) as Config;

        return newConfig;
    }

    export import AddressType = v1.AddressType;
    export type Address = v1.Address;
    export type SSHParams = v1.SSHParams;
    export type SSHAddress = v1.SSHAddress;
    export type Machine = v2.Machine;
    export type Config = v2.Config;
}