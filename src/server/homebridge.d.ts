declare module 'homebridge/lib/platformAccessory' {
    import { Service } from "hap-nodejs";

    interface PlatformAccessoryEvents {
        identify: boolean;
    }

    declare class PlatformAccessory {
        reachable: boolean;
        displayName: string;
        UUID: string;

        constructor(name: string, uuid: string);

        addService(service: Service): Service;
        addService(service: { new (...params: any[]) : Service }, ...params: any[]): Service;
        removeService(service: Service): void;
        getService(serviceName: string): Service;
        getService(service: typeof Service): Service;
        updateReachability(reachable: false): void;

        on<K extends keyof PlatformAccessoryEvents>(name: K, listener: (value: PlatformAccessoryEvents[K], ...params: any[]) => void);
    }
}