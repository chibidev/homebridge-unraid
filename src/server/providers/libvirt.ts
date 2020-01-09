import { PlatformAccessory } from "homebridge/lib/platformAccessory";
import { CommandAccessoryProvider, AccessoryProviderType, PlatformAccessories } from "../provider";
import { CommandExecutor } from "../commands";
import { VM } from "../models/vm";
import * as hap from "hap-nodejs";
import "../../util/promise";

export class LibvirtAccessoryProvider extends CommandAccessoryProvider {
    public constructor(executor: CommandExecutor) {
        super(AccessoryProviderType.Libvirt, executor);
    }

    protected async queryAccessories(): Promise<PlatformAccessory[]> {
        // TODO - remove that ugly json transformation
        const result = this.executor.run("virsh list --all --name | while read d; do [[ \"$d\" != \"\" ]] && virsh dominfo \"$d\" | tr -d ' ' | sed -e 's/^/\"/g' -e 's/:/\":\"/g' -e 's/$/\",/g'; done | sed -e 's/\"\"/}/g' -e 's/\"Id/{\"Id/g' -e 's/\"SecurityDOI\":\"\\(.*\\)\",/\"SecurityDOI\":\"\\1\"/g' -e 's/},/}/g' | jq -s");
        const vms = result.then((result) => JSON.parse(result) as VM[]).catch((reason) => {
            // might not be a fatal error, machine could be restarting
            return new Array<VM>();
        });

        const accessories = vms.map((vm) => {
            let accessory = this.accessoryCache[vm.Name];
            if (!accessory) {
                accessory = new PlatformAccessories.Switch(vm.Name);
                this.setupAccessory(accessory);
            }

            const switchService = accessory.services[1];
            switchService.getCharacteristic(hap.Characteristic.On)?.updateValue(vm.State.startsWith("running"));

            return accessory;
        });

        return accessories;
    }

    protected setupAccessory(accessory: PlatformAccessory): void {
        const switchService = accessory.services[1];
            
        let name = accessory.displayName;
        switchService.getCharacteristic(hap.Characteristic.On)?.on(hap.CharacteristicEventTypes.SET, async (value: boolean, callback: any) => {
            const command = (value) ? "virsh start " + name : "virsh dompmsuspend " + name + " disk";
            const data = this.executor.run(command);

            await data.finally(callback);
        });
    }
}