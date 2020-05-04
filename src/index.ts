import { HomeBridge, hap } from "./lib/homebridge";
import { Config } from "./server/models/config";
import { MachineController } from "./server/machine";
import * as Platform from "./lib/platform";
import "./util/promise";

namespace Unraid {
    export class ServerPlugin extends Platform.PlatformPlugin {
        public constructor(log: HomeBridge.Logger, config: Config.Config) {
            super(log, config);

            this.machineAccessories = {};
            this.controllers = config.machines.map((machineConfig) => {
                return MachineController.CreateFromConfig(machineConfig);
            });
        }

        public configure(): void {
            this.controllers.forEach((controller) => {
                let machineAccessory = this.machineAccessories[controller.name];
                if (machineAccessory === undefined) {
                    machineAccessory = new HomeBridge.PlatformAccessory(controller.name, hap.uuid.generate(controller.name));
                    this.machineAccessories[controller.name] = machineAccessory;

                    if (controller.controlsHost()) {
                        const hostService = new hap.Service.Switch(controller.name, "A");
                        hostService.isPrimaryService = true;
                        machineAccessory.addService(hostService);
                    }
                }

                if (controller.controlsContainers()) {
                    controller.containers.on("new", (container) => {
                        let service = machineAccessory.getService(container.Name);
                        if (service === undefined) {
                            this.logger.debug("Adding new service " + container.Name + " to " + controller.name);

                            service = new hap.Service.Switch(container.Name, container.Name);
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
                                    result = controller.start(container);
                                else
                                    result = controller.stop(container);
                                await result.finally(callback);
                            });
                        }
                        switchOnCharacteristic.updateValue(container.IsRunning);
                        container.on("update", (c) => {
                            switchOnCharacteristic.updateValue(c.IsRunning);
                        });
                    });

                    controller.containers.on("delete", (container) => {
                        let service = machineAccessory.getService(container.Name);
                        if (service !== undefined) {
                            this.logger.debug("Removing " + service.displayName + " from " + controller.name);

                            machineAccessory.removeService(service);
                        }
                    });

                    controller.on("availabilityUpdated", (available) => {
                        controller.containers.forEach((container) => {
                            this.logger.debug(controller.name + " is unavailable. Disabling all controls on containers.");

                            let service = machineAccessory.getServiceByUUIDAndSubType(container.Name, container.Name);
    
                            let perms = [hap.Perms.READ, hap.Perms.NOTIFY];
                            if (available || controller.autoOnEnabled)
                                perms.push(hap.Perms.WRITE);
    
                            service?.getCharacteristic(hap.Characteristic.On)?.setProps({
                                perms: perms
                            });
                            service?.setHiddenService(false); // Trigger update
                        });
                    });
                }

                if (controller.controlsVMs()) {
                    controller.vms.on("new", (vm) => {
                        let service = machineAccessory.getService(vm.Name);
                        if (service === undefined) {
                            this.logger.debug("Adding new service " + vm.Name + " to " + controller.name);

                            service = new hap.Service.Switch(vm.Name, vm.Name);
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
                                    result = controller.start(vm);
                                else
                                    result = controller.stop(vm);
                                await result.finally(callback);
                            });
                        }

                        switchOnCharacteristic.updateValue(vm.IsRunning);

                        vm.on("update", (v) => {
                            switchOnCharacteristic.updateValue(v.IsRunning);
                        })
                    });

                    controller.vms.on("delete", (vm) => {
                        let service = machineAccessory.getService(vm.Name);
                        if (service !== undefined) {
                            this.logger.debug("Removing " + service.displayName + " from " + controller.name);

                            machineAccessory.removeService(service);
                        }
                    });

                    controller.on("availabilityUpdated", (available) => {
                        controller.vms.forEach((vm) => {
                            this.logger.debug(controller.name + " is unavailable. Disabling all controls on vms.");

                            let service = machineAccessory.getServiceByUUIDAndSubType(vm.Name, vm.Name);
    
                            let perms = [hap.Perms.READ, hap.Perms.NOTIFY];
                            if (available || controller.autoOnEnabled)
                                perms.push(hap.Perms.WRITE);
    
                            service?.getCharacteristic(hap.Characteristic.On)?.setProps({
                                perms: perms
                            });
                            service?.setHiddenService(false); // Trigger update
                        });
                    });
                }

                if (controller.controlsHost()) {
                    let hostService = machineAccessory.getService(controller.name)!;
                    const switchOnCharacteristic = hostService.getCharacteristic(hap.Characteristic.On)!;
                    switchOnCharacteristic.on(hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
                        let result;
                        if (value)
                            result = controller.start();
                        else
                            result = controller.stop();
                        await result.finally(callback);
                    }).updateValue(controller.available);

                    controller.on("availabilityUpdated", (available) => {
                        switchOnCharacteristic.updateValue(available);
                    });
                }

                controller.startMonitoring();
            });
        }

        public configureCachedAccessory(accessory: HomeBridge.PlatformAccessory): boolean {
            let machine = this.controllers.find((m) => {
                return m.name == accessory.displayName;
            });
            if (machine === undefined)
                return false;

            this.machineAccessories[accessory.displayName] = accessory;

            return true;
        }

        protected async updateAccessories(): Promise<any[]> {
            return Object.values(this.machineAccessories);
        }

        private controllers: MachineController[];
        private machineAccessories: { [machineName: string]: HomeBridge.PlatformAccessory };
    }
}

export default Platform.register("homebridge-unraid", "UnraidServerPlatform", Unraid.ServerPlugin, Config.Traits);