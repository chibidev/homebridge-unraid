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

        protected async updateAccessoriesNow(): Promise<void> {
            const accessoriesFromAllMachines = this.machines.map((machine) => {
                return machine.accessories();
            });
            const accessories = flat(Promise.all(accessoriesFromAllMachines));

            return accessories.then((accessories) => {
                // TODO move this to Platform or PlatformPlugin instead of requiring the user to do this
                this.emit('accessoriesUpdated', accessories);
            });
        }

        private machines: Machine[];
    }
}

export default Platform.register("homebridge-unraid", "UnraidServerPlatform", Unraid.ServerPlugin);