import * as HomeBridge from "./lib/homebridge";
import { Config } from "./server/models/config";
import { MachineController } from "./server/machine";
import "./util/promise";

namespace Unraid {
    export class ServerPlugin extends HomeBridge.Platform.Plugin {
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
                    machineAccessory = new HomeBridge.Platform.Accessory(controller.name, HomeBridge.hap.uuid.generate(controller.name));
                    this.machineAccessories[controller.name] = machineAccessory;

                    if (controller.controlsHost()) {
                        const hostService = new HomeBridge.hap.Service.Switch(controller.name, "A");
                        hostService.isPrimaryService = true;
                        machineAccessory.addService(hostService);
                    }
                }

                if (controller.controlsContainers()) {
                    controller.containers.on("new", (container) => {
                        let service = machineAccessory.getService(container.Name);
                        if (service === undefined) {
                            this.logger.debug("Adding new service " + container.Name + " to " + controller.name);

                            service = new HomeBridge.hap.Service.Switch(container.Name, container.Name);
                            machineAccessory.addService(service);
                        } else {
                            service?.getCharacteristic(HomeBridge.hap.Characteristic.On)?.setProps({
                                perms: [HomeBridge.hap.Perms.PAIRED_READ, HomeBridge.hap.Perms.PAIRED_WRITE, HomeBridge.hap.Perms.NOTIFY]
                            });
                            service.setHiddenService(false);
                        }

                        const switchOnCharacteristic = service.getCharacteristic(HomeBridge.hap.Characteristic.On)!;
                        if (switchOnCharacteristic.listenerCount(HomeBridge.hap.CharacteristicEventTypes.SET) < 1) {
                            switchOnCharacteristic.on(HomeBridge.hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
                                if (! switchOnCharacteristic.props.perms.includes(HomeBridge.hap.Perms.PAIRED_WRITE))
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

                            let service = machineAccessory.getServiceById(container.Name, container.Name);
    
                            let perms = [HomeBridge.hap.Perms.PAIRED_READ, HomeBridge.hap.Perms.NOTIFY];
                            if (available || controller.autoOnEnabled)
                                perms.push(HomeBridge.hap.Perms.PAIRED_WRITE);
    
                            service?.getCharacteristic(HomeBridge.hap.Characteristic.On)?.setProps({
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

                            service = new HomeBridge.hap.Service.Switch(vm.Name, vm.Name);
                            machineAccessory.addService(service);
                        } else {
                            service?.getCharacteristic(HomeBridge.hap.Characteristic.On)?.setProps({
                                perms: [HomeBridge.hap.Perms.PAIRED_READ, HomeBridge.hap.Perms.PAIRED_WRITE, HomeBridge.hap.Perms.NOTIFY]
                            });
                            service.setHiddenService(false);
                        }

                        const switchOnCharacteristic = service.getCharacteristic(HomeBridge.hap.Characteristic.On)!;
                        if (switchOnCharacteristic.listenerCount(HomeBridge.hap.CharacteristicEventTypes.SET) < 1) {
                            switchOnCharacteristic.on(HomeBridge.hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
                                if (! switchOnCharacteristic.props.perms.includes(HomeBridge.hap.Perms.PAIRED_WRITE))
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

                            let service = machineAccessory.getServiceById(vm.Name, vm.Name);
    
                            let perms = [HomeBridge.hap.Perms.PAIRED_READ, HomeBridge.hap.Perms.NOTIFY];
                            if (available || controller.autoOnEnabled)
                                perms.push(HomeBridge.hap.Perms.PAIRED_WRITE);
    
                            service?.getCharacteristic(HomeBridge.hap.Characteristic.On)?.setProps({
                                perms: perms
                            });
                            service?.setHiddenService(false); // Trigger update
                        });
                    });
                }

                if (controller.controlsHost()) {
                    let hostService = machineAccessory.getService(controller.name)!;
                    const switchOnCharacteristic = hostService.getCharacteristic(HomeBridge.hap.Characteristic.On)!;
                    switchOnCharacteristic.on(HomeBridge.hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
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

        public configureCachedAccessory(accessory: HomeBridge.Platform.Accessory): boolean {
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
        private machineAccessories: { [machineName: string]: HomeBridge.Platform.Accessory };
    }
}

export default HomeBridge.Platform.register("homebridge-unraid", "UnraidServerPlatform", Unraid.ServerPlugin, Config.Traits);