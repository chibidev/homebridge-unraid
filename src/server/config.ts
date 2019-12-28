import { HomeBridge } from '../lib/homebridge';
import { AccessoryProviderType } from "./provider";

export namespace Config {
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