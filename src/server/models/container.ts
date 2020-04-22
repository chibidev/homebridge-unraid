import { TypedEventEmitter } from "../../util/events";
import { observed } from "../../util/reactive";

interface ContainerEvents {
    update: Container;
}

export enum PortProtocol {
    Tcp = "tcp",
    Udp = "udp"
}

export interface PublishedPort {
    ip: string;
    hostportrange: string;
    containerportrange: string;
    protocol: PortProtocol;
}

export class Container extends TypedEventEmitter<ContainerEvents> {
    Command: string = "";
    CreatedAt: string = "";
    ID: string = "";
    Image: string = "";
    Labels: { [_: string]: string } = {};
    LocalVolumes: string = "";
    Mounts: string[] = [];
    @observed Names: string[] = [];
    Networks: string = "";
    Ports: PublishedPort[] = [];
    RunningFor: string = "";
    Size: string = "";
    @observed Status: string = "";

    get Name(): string {
        return this.Names[0];
    }

    get IsRunning(): boolean {
        return this.Status.startsWith("Up ");
    }
}