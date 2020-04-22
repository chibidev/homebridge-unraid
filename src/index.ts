import { HomeBridge } from "./lib/homebridge";
import { Config } from "./server/models/config";
import { Machine } from "./server/machine";
import * as Platform from "./lib/platform";
import "./util/promise";

import * as HAP from "hap-nodejs";

const hap: typeof HAP = require.main?.require("hap-nodejs");

namespace Unraid {
    export class ServerPlugin extends Platform.PlatformPlugin {
        public constructor(log: HomeBridge.Logger, config: Config.Config) {
            super(log, config);

            this.machineAccessories = {};
            this.machines = config.machines.map((machineConfig) => {
                return new Machine(machineConfig);
            });
        }

        public configure(): void {
            this.machines.forEach((machine) => {
                let machineAccessory = this.machineAccessories[machine.Name];
                if (machineAccessory === undefined) {
                    machineAccessory = new HomeBridge.PlatformAccessory(machine.Name, hap.uuid.generate(machine.Name));
                    this.machineAccessories[machine.Name] = machineAccessory;

                    const hostService = new hap.Service.Switch(machine.Name, "A");
                    hostService.isPrimaryService = true;
                    machineAccessory.addService(hostService);
                }

                machine.containers.on("new", (container) => {
                    let service = machineAccessory.getService(container.Name);
                    if (service === undefined) {
                        service = new hap.Service.Switch(container.Name, "ContainerSwitch" + container.Name);
                        machineAccessory.addService(service);
                    } else {
                        service?.getCharacteristic(hap.Characteristic.On)?.setProps({
                            perms: [hap.Perms.READ, hap.Perms.WRITE, hap.Perms.NOTIFY]
                        });
                        service.setHiddenService(false);
                    }

                    const switchOnCharacteristic = service.getCharacteristic(hap.Characteristic.On)!;
                    if (switchOnCharacteristic.listenerCount(hap.CharacteristicEventTypes.SET) < 1) {
                        switchOnCharacteristic.on(hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
                            if (! switchOnCharacteristic.props.perms.includes(hap.Perms.WRITE))
                                return callback();

                            let result;
                            if (value)
                                result = machine.start(container);
                            else
                                result = machine.stop(container);
                            await result.finally(callback);
                        });
                    }
                    switchOnCharacteristic.updateValue(container.IsRunning);
                    container.on("update", (c) => {
                        switchOnCharacteristic.updateValue(c.IsRunning);
                    });
                });

                machine.containers.on("delete", (container) => {
                    let service = machineAccessory.getService(container.Name);
                    if (service !== undefined)
                        machineAccessory.removeService(service);
                });

                machine.vms.on("new", (vm) => {
                    let service = machineAccessory.getService(vm.Name);
                    if (service === undefined) {
                        service = new hap.Service.Switch(vm.Name, "VMSwitch" + vm.Name);
                        machineAccessory.addService(service);
                    } else {
                        service?.getCharacteristic(hap.Characteristic.On)?.setProps({
                            perms: [hap.Perms.READ, hap.Perms.WRITE, hap.Perms.NOTIFY]
                        });
                        service.setHiddenService(false);
                    }

                    const switchOnCharacteristic = service.getCharacteristic(hap.Characteristic.On)!;
                    if (switchOnCharacteristic.listenerCount(hap.CharacteristicEventTypes.SET) < 1) {
                        switchOnCharacteristic.on(hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
                            if (! switchOnCharacteristic.props.perms.includes(hap.Perms.WRITE))
                                return callback();

                            let result;
                            if (value)
                                result = machine.start(vm);
                            else
                                result = machine.stop(vm);
                            await result.finally(callback);
                        }).updateValue(vm.IsRunning);
                    }

                    switchOnCharacteristic.updateValue(vm.IsRunning);

                    vm.on("update", (v) => {
                        switchOnCharacteristic.updateValue(v.IsRunning);
                    })
                });

                machine.vms.on("delete", (vm) => {
                    let service = machineAccessory.getService(vm.Name);
                    if (service !== undefined)
                        machineAccessory.removeService(service);
                });

                let hostService = machineAccessory.getService(machine.Name)!;
                const switchOnCharacteristic = hostService.getCharacteristic(hap.Characteristic.On)!;
                switchOnCharacteristic.on(hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
                    let result;
                    if (value)
                        result = machine.start();
                    else
                        result = machine.stop();
                    await result.finally(callback);
                }).updateValue(machine.available);

                machine.on("availabilityUpdated", (available) => {
                    switchOnCharacteristic.updateValue(available);

                    machine.containers.forEach((container) => {
                        let service = machineAccessory.getServiceByUUIDAndSubType(container.Name, "ContainerSwitch" + container.Name);

                        let perms = [hap.Perms.READ, hap.Perms.NOTIFY];
                        if (available)
                            perms.push(hap.Perms.WRITE);

                        service?.getCharacteristic(hap.Characteristic.On)?.setProps({
                            perms: perms
                        });
                        service?.setHiddenService(false); // Trigger update
                    });

                    machine.vms.forEach((vm) => {
                        let service = machineAccessory.getServiceByUUIDAndSubType(vm.Name, "VMSwitch" + vm.Name);

                        let perms = [hap.Perms.READ, hap.Perms.NOTIFY];
                        if (available)
                            perms.push(hap.Perms.WRITE);

                        service?.getCharacteristic(hap.Characteristic.On)?.setProps({
                            perms: perms
                        });
                        service?.setHiddenService(false); // Trigger update
                    });
                });

                machine.startMonitoring();
            });
        }

        public configureCachedAccessory(accessory: HomeBridge.PlatformAccessory): boolean {
            let machine = this.machines.find((m) => {
                return m.Name == accessory.displayName;
            });
            if (machine === undefined)
                return false;

            this.machineAccessories[accessory.displayName] = accessory;

            return true;
        }

        protected async updateAccessories(): Promise<any[]> {
            return Object.values(this.machineAccessories);
        }

        private machines: Machine[];
        private machineAccessories: { [machineName: string]: HomeBridge.PlatformAccessory };
    }
}

export default Platform.register("homebridge-unraid", "UnraidServerPlatform", Unraid.ServerPlugin, Config.Traits);