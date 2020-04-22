import { TypedEventEmitter } from "../../util/events";
import { observed } from "../../util/reactive";

interface VMEvents {
    update: VM;
}

export class VM extends TypedEventEmitter<VMEvents> {
    Id: string = "";
    Name: string = "";
    UUID: string = "";
    OSType: string = "";
    Maxmemory: string = "";
    Usedmemory: string = "";
    Persistent: boolean = false;
    Autostart: string = "";
    Managedsave: string = "";
    Securitymodel: string = "";
    SecurityDOI: number = 0;
    @observed State: string = "";

    get IsRunning(): boolean {
        return this.State.startsWith("running");
    }
}