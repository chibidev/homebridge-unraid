import * as ssh from "ssh-exec";

export interface CommandExecutor {
    run(command: string): Promise<string>;
}

export class SSHCommandExecutor implements CommandExecutor {
    public constructor(ip: string) {
        this.ip = ip;
    }

    public async run(command: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const stream = ssh(command, this.ip);
            stream.on('error', (err: Error) => {
                reject(err || new Error('Error running command ' + command));
            });

            let result = "";
            stream.on('data', (chunk: string | Buffer) => {
                result += chunk.toString('utf-8');
            });

            stream.on('end', () => {
                resolve(result);
            });
        });
    }

    private ip: string;
}