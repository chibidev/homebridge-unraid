type Dictionary<T> = { [key: string]: T }

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

export class Container {
    Command: string;
    CreatedAt: string;
    ID: string;
    Image: string;
    Labels: { [_: string]: string };
    LocalVolumes: string;
    Mounts: string[];
    Names: string[];
    Networks: string;
    Ports: PublishedPort[];
    RunningFor: string;
    Size: string;
    Status: string;
}