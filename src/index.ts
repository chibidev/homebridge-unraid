import { HomeBridge } from "./lib/homebridge";
import { Config } from "./server/models/config";
import { Machine } from "./server/machine";
import * as Platform from "./lib/platform";
import { PlatformAccessory } from "homebridge/lib/platformAccessory";
import "./util/promise";

namespace Unraid {
    export class ServerPlugin extends Platform.PollingPlugin {
        public constructor(log: HomeBridge.Logger, config: Config.Config) {
            super(log, config, config.updateInterval);

            this.machines = config.machines.map((machineConfig) => {
                return new Machine(machineConfig);
            });
        }

        public configureAccessory(accessory: PlatformAccessory): boolean {
            if (!accessory || !accessory.context || !accessory.context.owner)
                return false;

            const machineId = accessory.context.owner.machine;
            const owner = this.machines.find((machine) => {
                return machine.Id == machineId;
            });

            if (!owner) {
                accessory.reachable = false;
                return false;
            }

            return owner.configureAccessory(accessory);
        }

        protected async updateAccessories(): Promise<PlatformAccessory[]> {
            const accessoriesFromAllMachines = this.machines.map((machine) => {
                return machine.accessories();
            });
            const accessories = Promise.all(accessoriesFromAllMachines).flat();

            return accessories;
        }

        private machines: Machine[];
    }
}

export default Platform.register("homebridge-unraid", "UnraidServerPlatform", Unraid.ServerPlugin, Config.Traits);