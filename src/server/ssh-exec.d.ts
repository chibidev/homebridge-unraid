declare module 'ssh-exec' {
    import { Duplex } from "stream";

    export interface Options {
        key: string;
        fingerprint: string;
        host: string;
        user: string;
        password: string;
        port: number;
    }

    function exec(command: string, options: string, callback?: (err: Error?, stdout: string, stderr: string) => void): Duplex;
    function exec<T extends Options>(command: string, options: T, callback?: (err: Error?, stdout: string, stderr: string) => void): Duplex;
    export = exec;
}