declare module 'homebridge/lib/platformAccessory' {
    import * as hap from "hap-nodejs";

    interface PlatformAccessoryEvents {
        identify: boolean;
    }

    class PlatformAccessory {
        reachable: boolean;
        displayName: string;
        UUID: string;
        category: hap.Accessory.Categories;
        services: hap.Service[];
        context: any;

        constructor(name: string, uuid: string);

        addService(service: hap.Service): hap.Service;
        addService(service: { new (...params: any[]) : hap.Service }, ...params: any[]): hap.Service;
        removeService(service: hap.Service): void;
        getService(serviceName: string): hap.Service;
        getService(service: typeof hap.Service): hap.Service;
        updateReachability(reachable: false): void;

        on<K extends keyof PlatformAccessoryEvents>(name: K, listener: (value: PlatformAccessoryEvents[K], ...params: any[]) => void): this;
    }
}