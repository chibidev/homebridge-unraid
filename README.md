# unRAID in HomeBridge

This plugin helps you get a basic overview of your services running on an unRAID server. You can select providers that provides you information and control over your server.

## Rationale

Now you might very reasonably ask why would anyone wanna do that? I can think of 3 possible reasons:

1. Get an easy management interface over your VMs and containers \
While there are some UIs available for both libvirt and docker, few of them will provide a good mobile experience as well. If you want to get a glimpse of how your servers' services are, this is a relatively easy solution. Of course it's not useful for anything more than quick status, turning on/off, so don't try to search for logs or any reasonable debugging experience. \
But, if you also got a HomeKit hub (like an iPad or HomePod), you get remote access straight out of the box.

2. Automation \
You might want to set up some automation not just with your lights and other accessories, but also regarding your server. Want to start up some services in the morning? Or turn them off when you leave the house? Want to turn off VMs when you say good night? Or just want to preserve some resources (e.g. network) and switch off some containers when you start up your gaming VM? You can do just that.

3. Because, well you, can \
I mean... It's quite fun. Especially on the Watch.

So if you're looking for a solution for any of the aforementioned reasons (or any other reasons whatsoever, like voice control), you've come to the right place.

## Installation
0. For the docker provider make sure docker and jq are installed. \
For the libvirt provier make sure virsh, sed and jq are installed.

1. Install this plugin either via HomeBridge GUI, or the following command
```
$ npm i -g homebridge-unraid
```

2. Enable the platform in HomeBridge's config.json and set up the servers and providers you want. \
You might need to restart HomeBridge to recognize the new plugin and load the new config.

## Example configuration

```json
{
    "bridge": {
        ...
    },
    "description": "This is an example configuration file with gui. You can use this as a template for creating your own configuration file containing devices you actually own.",
    "accessories": [ ... ],
    "platforms": [
        {
            "platform": "UnraidServerPlatform",
            "name": "Unraid",
            "machines": [
                {
                    "id": "FirstUnraidServer",
                    "enableContainers": true,
                    "enableVMs": true,
                    "host": {
                        "monitor": {
                            "type": "ssh+poll",
                            "interval": 15,
                            "ip": "user@192.168.1.1"
                        },
                        "publish": true,
                        "switchOffMechanism": "suspend",
                        "mac": "xx:xx:xx:xx:xx:xx",
                        "ip": "192.168.1.1"
                    }
                },
                {
                    "id": "ContainerServer",
                    "enableContainers": true,
                    "enableVMs": false,
                    "host": {
                        "monitor": {
                            "type": "ssh+poll",
                            "interval": 15,
                            "ip": "user@192.168.1.2"
                        },
                        "publish": false,
                        "ip": "192.168.1.2"
                    }
                }
            ]
        }
    ]
}
```

## Supported server addresses
Currently all servers must be reachable via **ssh** as it is the only available remote management tool. And there are also a few limitations you need to adhere to:
1. The server's fingerprint needs to be known. Currently it's not possible to acknowledge and provide feedback whether the server is who we think we are, so in case the server's fingerprint is unknown the commands will fail and no accessories will be present.
2. Kinda similar issue with user accounts with passwords. Either set up key-based authentication, or provide a user that has very limited permissions on the server and therefore can be passwordless.

More ways to reach the servers and run commands on it might be added later. Check the GitHub issues if you miss a particular way, and if it's not already there feel free to add it as an enhancement. \
Or send a pull request. I love PRs.

# Troubleshooting

**Q:** I have enabled this plugin but it shows no accessories. What might be the problem? \
**A:** You might wanna check the logs of HomeBridge, as some information might be available there. Usually it means that either you have misconfigured something, or running the commands on the server failed. Check your config and servers for some easy fixes:
1. You might have forgotten to enable providers (or the **right** providers).
2. The server's fingerprint might be unknown.
3. The user account used for ssh has a password.
4. The user account has no access to libvirt/docker.
5. jq might not be installed.


**Q:** Does this only work with unRAID? \
**A:** Not necessarily. Currently there's nothing unRAID specific in the code, however that might eventually change. When that happens there will be a different plugin (homebridge-linux-server or sg. like that) that provides the basic functionality and homebridge-unraid will build upon that. There are two main reasons why I decided to publish this as homebridge-unraid:
1. I am testing (and using) this on unRAID servers.
2. There are a few requirements that are present on an unRAID server, but might be missing on other linux servers.
    1. Libvirt and docker installed
    2. An account without password, but with access to libvirt and docker
    3. jq installed
