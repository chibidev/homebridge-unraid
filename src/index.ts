import { HomeBridge } from "./lib/homebridge";
import { Config } from "./server/models/config";
import { Machine } from "./server/machine";
import * as Platform from "./lib/platform";
import { flat } from "./util/promise";

namespace Unraid {
    export class ServerPlugin extends Platform.PollingPlugin {
        public constructor(log: HomeBridge.Logger, config: Config.Config) {
            super(log, config, config.updateInterval);

            this.machines = config.machines.map((machineConfig) => {
                return new Machine(machineConfig);
            });
        }

        protected async updateAccessoriesNow(accessoryContext: HomeBridge.Accessories.Context): Promise<void> {
            const accessoriesFromAllMachines = this.machines.map((machine) => {
                return machine.accessories(accessoryContext);
            });
            const accessories = flat(Promise.all(accessoriesFromAllMachines));

            return accessories.then((accessories) => {
                this.emit('accessoriesUpdated', accessories);
            });
        }

        private machines: Machine[];
    }
}

export default Platform.register("homebridge-unraid", "UnraidServerPlatform", Unraid.ServerPlugin);