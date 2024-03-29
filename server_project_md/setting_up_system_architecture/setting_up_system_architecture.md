## Setting Up System Architecture

<!-- Objective: Server node(s) with:
 * WireGuard VPN installed
 * VPN server running on manager (node with NFS share)
 * Worker nodes VPN clients connected to VPN server
 * NFS server running on manager node, sharing over VPN server
 * Worker nodes able to connect to NFS share through VPN
 * Docker installed on all nodes
 * All nodes in docker swarm (*optional: within VPN)
 * Portainer stack deployed to swarm
 *  -->

<!-- TOC:start -->

- [Setting Up System Architecture](#setting-up-system-architecture)
  - [Target Diagram](#target-diagram)
  - [VPN (WireGuard)](#vpn-wireguard)
    - [Install WireGuard](#install-wireguard)
    - [Choosing VPN IP address range](#choosing-vpn-ip-address-range)
    - [Setup WireGuard VPN server](#setup-wireguard-vpn-server)
      - [Generating a key pair](#generating-a-key-pair)
      - [Configuring the WireGuard server](#configuring-the-wireguard-server)
      - [Starting up the WireGuard server](#starting-up-the-wireguard-server)
    - [Setup WireGuard VPN client](#setup-wireguard-vpn-client)
      - [Generating a key pair](#generating-a-key-pair-1)
      - [Configuring the WireGuard client(s)](#configuring-the-wireguard-clients)
      - [Starting up the WireGuard client(s)](#starting-up-the-wireguard-clients)
      - [Add WireGuard Client to Server](#add-wireguard-client-to-server)
    - [Connecting and Testing the VPN](#connecting-and-testing-the-vpn)
  - [NFS](#nfs)
    - [Install NFS](#install-nfs)
      - [NFS Server](#nfs-server)
      - [NFS Client(s)](#nfs-clients)
    - [Configure NFS Server](#configure-nfs-server)
    - [Test mount NFS share](#test-mount-nfs-share)
  - [Docker](#docker)
    - [Install Docker](#install-docker)
      - [Install Docker Using an Automated Script](#install-docker-using-an-automated-script)
      - [Manually Install Docker on Raspberry Pi OS (Debian)](#manually-install-docker-on-raspberry-pi-os-debian)
      - [Manually Install Docker on Orange Pi (Ubuntu)](#manually-install-docker-on-orange-pi-ubuntu)
      - [Adding Current User to Docker Group](#adding-current-user-to-docker-group)
    - [Create Docker Swarm](#create-docker-swarm)
      - [Create Swarm Manager](#create-swarm-manager)
      - [Add Swarm Workers](#add-swarm-workers)
    - [Deploy Portainer Across Docker Swarm](#deploy-portainer-across-docker-swarm)
      - [Create Network Share Directory for Portainer Data](#create-network-share-directory-for-portainer-data)
      - [Download Portainer Stack YAML File](#download-portainer-stack-yaml-file)
      - [Edit Portainer Stack YAML Configuration](#edit-portainer-stack-yaml-configuration)
      - [Deploy Portainer Stack](#deploy-portainer-stack)
      - [Access Portainer GUI](#access-portainer-gui)

<!-- TOC:end -->

### Target Diagram

<p align="center">
  <img src="./resources/diagram_setting_up_system_architecture.svg" alt="Diagram: Setting Up System Architecture"/>
</p>

### VPN (WireGuard)

<p align="center">
  <img src="./resources/diagram_VPN_on_LAN.svg" alt="Diagram: VPN on LAN"/>
</p>

I will be running a WireGuard Server on the manager server node of my cluster, this server will be used exclusively by the server nodes to share data.   

The VPN will not be used to tunnel all data to the local network or the internet, the nodes will be able to connect to the internet to update and download docker images.

The VPN (Virtual Private Network) will encrypt all the data that is shared across the server nodes and provide a degree of separation from the rest of the local network.   

There are two main VPN protocols, OpenVPN and WireGuard, both are considered secure and reliable, OpenVPN being the more mature and more widely available.   
As WireGuard is very performant on the linux kernel, this makes it an excellent choice as the performance overhead will be minimized.    

It is recommended to have a Static IP address on all devices that will be a part of the VPN.   

#### Install WireGuard

<p align="center">
  <img src="./resources/diagram_install_VPN.svg" alt="Diagram: Install VPN"/>
</p>

Installing WireGuard should be same on both the Raspberry Pi (Debian) and Orange Pi (Ubuntu).   

To install WireGuard, run:
```
sudo apt install wireguard
```
WireGuard must be installed on all the server nodes.

#### Choosing VPN IP address range

<p align="center">
  <img src="./resources/diagram_VPN_ip_range.svg" alt="Diagram: VPN on LAN IP Range"/>
</p>

Devices within the VPN, will have a separate network interface to connect with each other, this separate network interface will have it's own IP address.   
This IP address will not be exposed to the rest of the local network, it will only be used to connect to server nodes within the VPN.   

The block of IP addresses can be within the range below:

```
10.0.0.0     to    10.255.255.255   
172.16.0.0   to    172.31.255.255   
192.168.0.0  to    192.168.255.255   
```

I will be using the block of addresses in the `10.10.10.0/24` range, this is `10.10.10.0` to `10.10.10.254`.   

#### Setup WireGuard VPN server 

<p align="center">
  <img src="./resources/diagram_VPN_server.svg" alt="Diagram: VPN Server"/>
</p>

Now that WireGuard has been installed and we have chosen an IP address range, the WireGuard server can be configured and set up.
The WireGuard server will be the central node that all the other nodes communicate with.   
To only permit specific nodes to connect to the server and securely communicate over the WireGuard interface, we must generate a key pair.   
A key pair is a public and private key, this allows data to be encrypted by any node with the public key but only decrypted by nodes with the private key.   
The server will have its own private key that it keeps secret, and a public key the client nodes will use to connect to the server.

##### Generating a key pair
The key pair can be generated on any of the server nodes, for simplicity, the key pair for the the server will be generated on the server node.   

First, generate the ***private key***.   
On the server node, run:
```
wg genkey | sudo tee /etc/wireguard/private.key
```

This command should output the *private key*. ***Make a note of this key***.

The key is saved to `/etc/wireguard/private.key`.   
This key doesn't need to be shared, it is only used by the node to the decrypt secure data, therefore, to keep it safe, it is a good idea to remove all permissions on the file for all users except the root user.   
To do this, run the command:   
```
sudo chmod go= /etc/wireguard/private.key
```
You can still output the private key using `sudo`.   
To view the `private.key` file, run `sudo cat /etc/wireguard/private.key`, this should output the private key.   

Next, we will generate the corresponding public key, this public key is derived from the private key.   

To generate a corresponding public key, run:   
```
sudo cat /etc/wireguard/private.key | wg pubkey | sudo tee /etc/wireguard/public.key
```
This command should output the *public key*. ***Make a note of this key also***.   

##### Configuring the WireGuard server

The WireGuard server can now be configured with the IP address range and the private key.   
We will create a new configuration file to set up the server.   
The `nano` editor can be used to create and edit this configuration file.
I will be creating the configuration within the directory `/etc/wireguard`, the file will be named `wg0.conf`.   

To create the new file in the desired location, run:
```
sudo nano /etc/wireguard/wg0.conf
```
The file isn't created until saved (`Ctrl + S` or exiting and choosing the save option `Ctrl + X`).   

The configuration in this file is as follows:
```
[Interface]
PrivateKey = <base64_encoded_private_key_goes_here>
Address = <server_ip_address>/<subnet_mask>
ListenPort = <vpn_listen_port>
SaveConfig = true
```

If my private key is: `iFpE8J8JZhGoWPMRQvUxoAads+EjEjtiL2I4eE476n0=`, my configuration would be:
```
[Interface]
PrivateKey = iFpE8J8JZhGoWPMRQvUxoAads+EjEjtiL2I4eE476n0=
Address = 10.10.10.0/24
ListenPort = 51820
SaveConfig = true
```
I will be setting my WireGuard server's IP address as `10.10.10.0`, so this is what I put as the `server_ip_address`.   
As the allowed IP address range of the clients is between `10.10.10.0` to `10.10.10.255`, the `subnet_mask` is `24`.   
The default port for WireGuard is `51820`, I will be leaving this as the default.   

Save this configuration file using `Ctrl + S` and exit using `Ctrl + X`.   

##### Starting up the WireGuard server

Now that the WireGuard server is configured, it can be started up.   
The VPN can be configured to start up at boot automatically using `systemctl`.   
To enable `systemctl` to automatically start the WireGuard service, run:   
```
sudo systemctl enable wg-quick@wg0.service
```
If you named the config something other than `wg0`, remember to use that filename in the command.   

> You can create multiple configurations and enable multiple servers all with different keys and IP address ranges.   

The service can now be started:   
```
sudo systemctl start wg-quick@wg0.service
```
You can check to see if the service is running using:   
```
sudo systemctl status wg-quick@wg0.service
```
You should see `active (running)`, in the output (usually green).   

A new interface should be added to `ifconfig` called `wg0`.   

#### Setup WireGuard VPN client

<p align="center">
  <img src="./resources/diagram_VPN_client.svg" alt="Diagram: VPN Server and Client"/>
</p>

The setup to make WireGuard run as a client is similar to setting up WireGuard as a a server, the main difference is in the configuration file.

##### Generating a key pair

Every server node (Manager and Worker) will need a key pair.   
The process of [generating the key pair](#generating-a-key-pair) for a client node, is the same as the server nodes.    

For simplicity, I will generate the key pair for the client(s) on the client node(s).   
Remember to make a note of the `private key` and `public key` for each node.

##### Configuring the WireGuard client(s)

Just as when [configuring the WirGuard server](#configuring-the-wireguard-server), on the client(s) (worker server nodes), create a configuration file within the directory `/etc/wireguard`, the file will also be named `wg0.conf`.   

```
sudo nano /etc/wireguard/wg0.conf
```

```
[Interface]
PrivateKey = <base64_encoded_private_key_goes_here>
Address = <client_ip_address>/<subnet_mask>

[Peer]
PublicKey = <base64_encoded_server_public_key_goes_here>
AllowedIPs = <vpn_subnet>
Endpoint = <ip_address_of_vpn_server>:<vpn_server_listen_port>
```

For Worker Node 1 (Client),   
If my `private key` is `____KEY____CLIENT_PRIVATE____KEY____=`, and my server's `public key` is `____KEY____SERVER_PUBLIC____KEY____=`.

My configuration would be:
```
[Interface]
PrivateKey = ____KEY____CLIENT_PRIVATE____KEY____=
Address = 10.10.10.1/24

[Peer]
PublicKey = ____KEY____SERVER_PUBLIC____KEY____=
AllowedIPs = 10.10.10.0/24
Endpoint = 192.168.2.100:51820
```

I will be setting my Worker Node 1 IP address to `10.10.10.1`, so this is what I put as the `client_ip_address`
As the allowed IP address range of the clients is between `10.10.10.0` to `10.10.10.255`, the `subnet_mask` is `24`.   
The `AllowedIPs` is therefore set to `10.10.10.0/24`.   
The `static IP address` of the server is `192.168.2.100`.   
The listen port for the WireGuard server is set to  `51820` (default, set [above](#configuring-the-wireguard-server)).   


Save this configuration file using `Ctrl + S` and exit using `Ctrl + X`.   

##### Starting up the WireGuard client(s)

Starting the WireGuard Client is the same as [starting the WireGuard Server](#starting-up-the-wireguard-server).   

Enable the service to run at boot:
```
sudo systemctl enable wg-quick@wg0.service
```

The service can now be started:   
```
sudo systemctl start wg-quick@wg0.service
```

You can check to see if the service is running using:   
```
sudo systemctl status wg-quick@wg0.service
```
You should see `active (running)`, in the output (usually green).   

A new interface should be added to `ifconfig` called `wg0`.   

##### Add WireGuard Client to Server

The WireGuard services should be running on the Server and Client(s).   

To add the client to the server, a command is run on the WireGuard server node, this command updates the configuration of the server's `wg0.conf` file.   
The command uses the `public key` of the client and the configured VPN IP address of the client.

The command is as follows:   
```
sudo wg set <wireguard_server_interface> peer <client_public_key> allowed-ips <client_VPN_ip_address>
```
If the WireGuard client on Worker Node 1 has the public key `____KEY____CLIENT_PUBLIC____KEY____=`, to add Worker Node 1, I would run the command:   

```
sudo wg set wg0 peer ____KEY____CLIENT_PUBLIC____KEY____= allowed-ips 10.10.10.1
```

My server's WireGuard interface (and config file) is named `wg0`, so this is the value in `<wireguard_server_interface>`.   
The client's (Worker Node 1) VPN IP address is set to `10.10.10.1`, so this is the value in `<client_VPN_ip_address>`.   

All clients can be added using this command.

To see all added clients, run `sudo wg` on the server, this should output all clients added.   

<p align="center">
  <img src="./resources/wireguard_peers_on_server.png" alt="WireGuard Peers on Server"/>
</p>

Running `sudo wg` on the client should only show one `peer`, the server.

<p align="center">
  <img src="./resources/wireguard_server_on_peer.png" alt="WireGuard Server on Peer"/>
</p>

#### Connecting and Testing the VPN

Now that all the configuration is set up, the client and server nodes can connect.   

To test the connection, we can use the built in program `ping`.   

On the WireGuard server attempt to `ping` one of the client VPN IP addresses.   
To `ping` Worker Node 1, I run the command:   

```
ping 10.10.10.1
```

`ping` will continue running until stopped (`Ctrl + C`).

This is expected to fail with with error messages: 

<p align="center">
  <img src="./resources/wireguard_ping_client_over_vpn_fail.png" alt="WireGuard ping client over VPN fails"/>
</p>

The top error message (`Destination Host Unreachable`) implies that there may be something wrong with the client.   
However, pinging the clients static IP address should be successful.   
```
ping 192.168.2.101
```

<p align="center">
  <img src="./resources/wireguard_ping_client_static_ip.png" alt="WireGuard ping client static IP success"/>
</p>

The reason pinging the client over the VPN fails is because the server only has the clients `public key` and VPN IP address.   
The server needs the client's `static IP address` and VPN `port` in order to connect to the client.   

In order to provide this information to the VPN server, the ***initial connection must be made by the client***.   

On the client, `ping` the server using the server VPN IP address.

```
ping 10.10.10.0
```
This should be successful.   

<p align="center">
  <img src="./resources/wireguard_ping_server_over_vpn.png" alt="WireGuard ping server over VPN"/>
</p>

The server should now have the required information to maintain a connection to the client.   
Running `sudo wg` on the server should have new client information populated by the initial `handshake`.

<p align="center">
  <img src="./resources/wireguard_server_peer_handshake.png" alt="WireGuard Server Peer Handshake info"/>
</p>

Pinging the client via the server over the VPN should be successful.

<p align="center">
  <img src="./resources/wireguard_ping_client_over_vpn_success.png" alt="WireGuard ping client over VPN succeeds"/>
</p>

Any client added to the VPN should ping the server for this initial handshake.

### NFS

<p align="center">
  <img src="./resources/diagram_NFS_over_VPN.svg" alt="Diagram: NFS over VPN"/>
</p>

I will be using NFS (Network File System), for the persistent network storage across the server nodes.   
NFS allows us to mount a directory from a host server node onto a client server node.   
I will have an NFS server running on the manager node serving a directory to all nodes.   
The shared directory will be on the USB mounted SSD on the manager server node.   

NFS is very performant and highly optimised to run on the linux kernel.   

#### Install NFS

NFS is not installed by default on any of our chosen operating systems.   
Therefore, it must be installed via `apt` onto the server nodes.

##### NFS Server

<p align="center">
  <img src="./resources/diagram_NFS_install_server.svg" alt="Diagram: NFS install server"/>
</p>

On the server node where the NFS server will be hosted (Manager Node), run the following command to install the required packages for the NFS server:

```
sudo apt install nfs-kernel-server
```

##### NFS Client(s)

<p align="center">
  <img src="./resources/diagram_NFS_install_client.svg" alt="Diagram: NFS install client"/>
</p>

On the client nodes where the directory will be mounted and not served (Worker Nodes), run the following command to install the packages to mount an NFS shared directory:

```
sudo apt install nfs-common
```
This installs less packages than the NFS server.

#### Configure NFS Server

<p align="center">
  <img src="./resources/diagram_NFS_server_over_VPN.svg" alt="Diagram: NFS Server over VPN"/>
</p>

The NFS server is configured by a config file, in the `/etc` directory.   
When the NFS server packages were [installed](#nfs-server), a file should have been automatically created in `/etc` called `exports`.   
In this file we enter the configuration for the NFS server.

To open the file, run:
```
sudo nano /etc/exports
```
The file should have some commented examples of configuration entries.   

We will add our own entry to the file in the following format.

```
<directory_to_share>        <ip_address_to_expose_over>/<subnet_mask_of_allowed_connections>(<share_options...>)
```

The `<directory_to_share>` is the directory that will be shared by the NFS server.   
The `<ip_address_range_to_expose_over>` is the ip address of the NFS server node that the NFS server will be shared to.   
The `<share_options...>` are the configuration options of this particular share.   

**By default NFS shares are not encrypted**, therefore, we will be exposing the NFS share over the VPN which encrypts all traffic automatically.   
To do this, set the `<ip_address_to_expose_over>` to the  `ip_address` of the VPN server (`wg0`), on the server node. To limit the allowed connections to only the VPN client servers, set the `<subnet_mask_of_allowed_connections>` to the `subnet_mask` of the VPN `ip_adress` range.   

There are [many `<share_options...>`](https://www.thegeekdiary.com/understanding-the-etc-exports-file/) for the NFS server, I will be using the default options (`rw,sync,no_subtree_check`).

For my NFS server, I add the line:

```
/mnt/extdisk       10.10.10.0/24(rw,sync,no_subtree_check)
```

`/mnt/extdisk`, this is the directory of my mounted SSD.   
`10.10.10.0/24`, my [chosen IP address range](#choosing-vpn-ip-address-range) for the VPN.   

After entering the configuration, save the file `Ctrl + S` and exit the editor `Ctrl + X`.   

With the new configuration added, the NFS server needs to be restarted to run the new configuration.   
To restart the NFS server, run:

```
sudo systemctl restart nfs-kernel-server
```

Check if the NFS server successfully started with the new configuration by running:
```
sudo systemctl status nfs-kernel-server
```
The status should be `active`.

#### Test mount NFS share

<p align="center">
  <img src="./resources/diagram_NFS_test_mount_over_VPN.svg" alt="Diagram: NFS Client Mount over VPN "/>
</p>

The NFS share should be test mounted on an NFS client (Worker Node), to ensure that the NFS share can be successfully mounted.   

On the client node, create a new directory where the NFS share will be mounted.

```
sudo mkdir /nfs
```

Attempt to mount the NFS share on the client.

```
sudo mount <ip_address_of_nfs_server>:<shared_directory_on_server> <directory_where_share_will_be_mounted>
```

For my configuration I run the following command:

```
sudo mount 10.10.10.0:/mnt/extdisk /nfs
```

`10.10.10.0`, this is the `ip_address` of the NFS server.   
`/mnt/extdisk`, this is the directory shared by the NFS server.   
`/nfs`, this is the new directory created where the NFS share is to be mounted.

To see the listed mount, run `df -h`, the mounted share should be listed.   

<p align="center">
  <img src="./resources/mounted_nfs_share.png" alt="NFS mounted share, shown in df -h"/>
</p>

The mount can also be tested by creating a new file (`touch newfile.txt`) or directory (`mkdir newdir`) in the mounted share within `/nfs` and then viewing the new directory and/or file in the `/mnt/extdisk` directory in the NFS server node.

As this is only a test mount, the mounted directory should be unmounted.   
To unmount, run:   

```
sudo umount /nfs
```

The folder for the mount should also be cleaned.

```
sudo rm -rf /nfs
```

### Docker

<p align="center">
  <img src="./resources/diagram_docker.svg" alt="Diagram: Docker "/>
</p>

Applications on the servers will be containerized and run on docker for easier management.   
Docker Swarm will be use to orchestrate across the different hosts.   
Portainer will be the first container on all the hosts, it will be deployed across the swarm to manage docker across all the hosts.

#### Install Docker

<p align="center">
  <img src="./resources/diagram_docker_install.svg" alt="Diagram: Docker Install"/>
</p>

Docker must be ***installed on all the server nodes***, the steps are similar on both the Raspberry Pi (Debian) and Orange Pi (Ubuntu).
There are many alternative guides available online to install docker on [Debian](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-debian-10) and [Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-22-04).

##### Install Docker Using an Automated Script

Docker publish a script that automatically installs Docker on linux systems.   
This is the quickest way to install Docker and all its dependencies.   
This install script can be run on both the Raspberry Pi and Orange Pi. 

First download the script.   
We can use `curl` to download the script, if `curl` is not already installed on the system, it can be installed by running:   
```
sudo apt install curl
```

Download the install script.   
```
curl -fsSL https://get.docker.com -o get-docker.sh
```

This should download a script file and name it "`get-docker.sh`".   

> The script file can be viewed using `nano get-docker.sh`.
> There shouldn't be any changes necessary to the script file.
> Exit the `nano` editor using `Ctrl + X`.

Run the script.   
```
sudo sh get-docker.sh
```
Run the script with `sudo` to ensure the script does not run into any permission errors.   

When the install has finished, Docker should be installed and running.

We can check if docker is running using:
```
sudo systemctl status docker
```

The output should show docker as `active` (in green).

<p align="center">
  <img src="./resources/docker_running_systemctl.png" alt="Docker running in systemctl "/>
</p>

> Use the `q` key to exit out of the output back into the terminal.

We can also see if docker is installed by running the command `sudo docker --version` in the terminal and seeing if there is an output.   

See how to [add a user to the docker group](#adding-current-user-to-docker-group), this allows us to run `docker` without `sudo`.

The script file can now be cleaned.   
```
rm get-docker.sh
```

##### Manually Install Docker on Raspberry Pi OS (Debian)

First update the list of repositories and packages using:   
```
sudo apt update
```

We will be installing using the latest docker repository as the repository in `apt` may install an older version of docker.   
Therefore we need to add the docker repository to `apt`.   

Install some prerequisite packages to securely add the repository.   
```
sudo apt install apt-transport-https ca-certificates curl gnupg2 software-properties-common
```

Next add the GPG key for the official Docker repository.   
```
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo apt-key add -
```

Now the docker repository can be added.   
```
sudo add-apt-repository "deb [arch=$(dpkg --print-architecture)] https://download.docker.com/linux/debian $(lsb_release -cs) stable"
```

Update the list of repositories and packages to allow the new repository sources to be recognized.   
```
sudo apt update
```

Docker can now be installed using:
```
sudo apt install docker-ce
```

This should install multiple packages relevant to docker.   

After the install finished, check if docker is running using:
```
sudo systemctl status docker
```

The output should show docker as `active` (in green), as above in when [installing docker using an automated script](#install-docker-using-automated-script).  

We can also see if docker is installed by running the command `sudo docker --version` in the terminal and seeing if there is an output.    

Running a `docker` command generally requires `sudo` before the command, however, on Raspberry Pi OS, the `sudo` command is not often needed due to the `pi` user having elevated privileges.  

We will however still add the `pi` user to the auto generated docker group, this is how the `docker` command is run without appending `sudo` on Debian operating systems.   

See how to [add a user to the docker group](#adding-current-user-to-docker-group), this allows us to run `docker` without `sudo`.

##### Manually Install Docker on Orange Pi (Ubuntu)

> The commands to install on Ubuntu are mostly similar to Debian. However there are some differences.   

First update the list of repositories and packages using:   
```
sudo apt update
```

Install some prerequisite packages to securely add the repository.   
```
sudo apt install apt-transport-https ca-certificates curl software-properties-common
```

Next add the GPG key for the official Docker repository.   
```
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
```

Now the docker repository can be added.   
```
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Update the list of repositories and packages to allow the new repository sources to be recognized.   
```
sudo apt update
```

Docker can now be installed using:
```
sudo apt install docker-ce
```

This should install multiple packages relevant to docker.   

After the install finished, check if docker is running using:
```
sudo systemctl status docker
```

The output should show docker as `active` (in green), as above in when [installing docker using an automated script](#install-docker-using-automated-script).  

We can also see if docker is installed by running the command `sudo docker --version` in the terminal and seeing if there is an output.   

Running the docker command on Ubuntu on the `orangepi` will require `sudo`.   
The steps to add the `orangepi` user to the docker group are the same as [Debian](#install-docker-on-raspberry-pi-os-debian).   

See how to [add a user to the docker group](#adding-current-user-to-docker-group), this allows us to run `docker` without `sudo`.

##### Adding Current User to Docker Group

To add the current user to the `docker` group, run   
```
sudo usermod -aG docker ${USER}
```

To apply the new settings, log out and back in to the server node, or run the following command.   
```
su - ${USER}
```

#### Create Docker Swarm

<p align="center">
  <img src="./resources/diagram_docker_swarm.svg" alt="Diagram: Docker Swarm "/>
</p>

Docker comes with Docker swarm built in so there is no need for further installation.   

The swarm will run over local network (LAN) and create its own network interface, this is called the `ingress` network, it is used for docker communication between installations of docker on all the server nodes.   
As the `ingress` network is encrypted it will remain running on the LAN instead of over the VPN.   

The swarm requires at least one manager node to manage all the docker engines on the server nodes, we will be using the Raspberry Pi as the manager node as this is the node running the [VPN server](#configuring-the-wireguard-server) and [NFS server](#configure-nfs-server).   

##### Create Swarm Manager
To create the swarm manager run the following command on the manager server node.   
```
docker swarm init --advertise-addr <lan_ip_address>
```
The `<lan_ip_address>` is the `ip` address of the server node on the `eth0` interface. Use `ifconfig` to find out the `ip` address. 
I would run the command:

```
docker swarm init --advertise-addr 192.168.2.100
```

`192.168.2.100` is the static `ip`address I set on the Raspberry Pi on the `eth0` interface.   

Running the command should initialize the swarm.   

<p align="center">
  <img src="./resources/docker_swarm_init.png" alt="Docker swarm init"/>
</p>

The output should give a command to add workers to the swarm. (To be run on the worker nodes)   
The command contains unique a key to securely join the swarm.   

The current nodes in the swarm can be listed using the following command (only on a manager node).   
```
docker node ls
```

There should only be one manager node in the swarm.   

<p align="center">
  <img src="./resources/docker_swarm_init_node_list.png" alt="Docker swarm init node list"/>
</p>

##### Add Swarm Workers
Adding a worker node to the swarm is as simple as running the command output by the manager node.   
The command is output when the [swarm is created](#create-docker-swarm).   

The command to join the swarm as a worker can be output again using the following command.   
(Run on the manager node)
```
docker swarm join-token worker
```

Run the command on every server node to be added as a worker.   

<p align="center">
  <img src="./resources/docker_swarm_worker_join.png" alt="Docker swarm add worker"/>
</p>

When all server nodes have been added, run `docker node ls` on the manager node to see all the nodes listed.   

<p align="center">
  <img src="./resources/docker_swarm_all_node_list.png" alt="Docker swarm all nodes list"/>
</p>

#### Deploy Portainer Across Docker Swarm

<p align="center">
  <img src="./resources/diagram_docker_swarm_deploy_portainer.svg" alt="Diagram: Docker Swarm Deploy Portainer "/>
</p>

[Portainer](https://www.portainer.io/) allows us to manage all the docker instances in our swarm, we will have access to a web browser based GUI (Graphical User Interface) to deploy and configure containers across all nodes in the swarm.

<p align="center">
  <img src="./resources/portainer_gui_gif.gif" alt="Portainer GUI showcase gif"/>
</p>

Portainer itself runs as a stack of services across the swarm.   
This means it is installed as docker containers on our servers that auto scale and deploy across all server nodes in the swarm.   
There are two services:
A Portainer service which runs a single container on a single manager node.
A Portainer Agent service which runs a single container on every manager and worker node.   

Both of these services are scaled and deployed automatically when the stack is deployed.   

To deploy the stack there are a few preliminary steps.   

We will be deploying our Portainer stack ***with persistent network stored data***.   
This means that the data Portainer save data (configurations, user logins .etc) will be persisted to a network shared location.   
There main advantage of this configuration is that the save data is still available even if the container is redeployed.   
Also, if the swarm should grow and more manager nodes are added, the save data is available across all server nodes in the the network file share.   
So if the Portainer service deploys the container on another manager node, Portainer save data is still available if the network share is still accessible.   

Deploying the Portainer stack with the persistent network share which is available only through the VPN, is also a way to affirm the installations of the VPN service, the NFS service and Docker.

##### Create Network Share Directory for Portainer Data
The USB SSD mounted to the manager node is [shared via NFS](#configure-nfs-server).   
This is where the Portainer save data will be persisted.   

Change directories into the mounted drive. My drive is mounted in the directory `mnt/extdisk`.
```
cd /mnt/extdisk
```

As other container save data may also be persisted, we will create a directory specifically for the Portainer save data.   
I will create the directory `./config/portainer/portainer_shared_data/`
```
sudo mkdir -p ./config/portainer/portainer_shared_data
```
This creates (in `/mnt/extdisk`):
```
extdisk/
├─ config/
│  ├─ portainer/
│  │  ├─ portainer_shared_data/
```

The `config/` directory will contain configuration data for the server.

Within the `config/` directory, is the `portainer/` directory, this will contain the configuration data for Portainer.

Withing the `portainer/` directory, is the `portainer_shared_data/` directory, this is where the Portainer save data will be persisted.   

We now have a directory to persist the portainer save data.   

However, we cannot actually write to this directory via NFS.   
This is to because of the permissions set on the directory (`/mnt/extdisk/config/portainer/portainer_shared_data/`).   

The permissions of the directory can be viewed using the `ls -l` command.   
```
ls -l /mnt/extdisk/config/portainer
```

This should output the information of files and directories within the `/mnt/extdisk/config/portainer/` directory.   

As the only file/directory within `/mnt/extdisk/config/portainer/` is `portainer_shared_data/` the output should be as shown below.

<p align="center">
  <img src="./resources/directory_info_portainer_shared_data_root_root.png" alt="directory info of /mnt/extdisk/config/portainer/ using ls -l showing root root"/>
</p>

The two relevant parts of this out put are "`root root`".   
These show the user and group of the directory, currently the `portainer_shared_data/` directory belongs to the user `root` and the group `root`.   
This means this directory is only accessible to the `root` user and `root` group.   

The Portainer docker container will not be accessing this directory as `root` so there will be a permission error when saving or accessing the files.

A method of fixing this could be to add "`no_root_squash`" to the share options in when [configuring the NFS server](#configure-nfs-server).   
However, this is not recommended as it allows the NFS clients to access all files and directories in the shared directory, even those with `root` permissions.   

Instead, we will change the user and group of the `portainer_shared_data/` directory so that the directory can be accessed by docker containers.   
Changing the `user` to `nobody` and the `group` to `nogroup` should allow docker container access over NFS.   

To make this change run the following command:
```
sudo chown -R nobody:nogroup /mnt/extdisk/config/portainer/portainer_shared_data/
```

> The `-R` flag runs the command recursively over the directory so all the sub-directories and files also have their permissions changed.   

Running `ls -l` should show `nobody` and `nogroup`.

<p align="center">
  <img src="./resources/directory_info_portainer_shared_data_nobody_nogroup.png" alt="directory info of /mnt/extdisk/config/portainer/ using ls -l showing nobody nogroup"/>
</p>

An NFS shared directory is now ready for Portainer container save data to be persisted into.

##### Download Portainer Stack YAML File

The [portainer website](https://www.portainer.io/) shows instructions on how to install portainer on many systems.   

<p align="center">
  <img src="./resources/portainer_io_get_download_script_gif.gif" alt="Portainer.io website path to download config yaml"/>
</p>

Download the config YAML to deploy the community version of portainer, the script can be found [here](https://docs.portainer.io/start/install/server/swarm/linux), or by following the video above.

> Be sure to select the ***community edition*** of Portainer.

The download command should be similar to the command below.   
```
curl -L https://downloads.portainer.io/ce2-14/portainer-agent-stack.yml -o portainer-agent-stack.yml
```
This command downloads the YAML (`.yml`) file and ensures it is named `portainer-agent-stack.yml`.

> Get the latest version of Portainer using the latest version of the script from the [website](https://www.portainer.io/)

To download the config file run the command given on the website on manager node.    

I will be downloading the config to the specified Portainer config directory set up [previously](#create-network-share-directory-for-portainer-data).   
```
/mnt/extdisk/config/portainer/
```

We can change directory to the location (`cd /mnt/extdisk/config/portainer/`) and then run the download `curl` command.   
Use `sudo` to download to this directory as it is a `root` directory.   

If already downloaded, we can move the config file to the correct location using `mv`.
```
sudo mv portainer-agent-stack.yml /mnt/extdisk/config/portainer/
```
`sudo` is required as the destination directory is `root`.

##### Edit Portainer Stack YAML Configuration

Before deploying the configuration we must first edit the configuration file (`portainer-agent-stack.yml`).   
This is to add the location to persist the Portainer save data.

Open the file with the `nano` editor.
```
sudo nano portainer-agent-stack.yml
```

The file should start with `version` and then have the services below.

<p align="center">
  <img src="./resources/portainer_agent_stack_yml_file.png" alt="nano portainer-agent-stack.yml file"/>
</p>

> `portainer-agent-stack.yml` is in the format of a `docker-compose` file.

At the bottom, in `volumes`, there should be an empty entry called `portainer_data`.   
This is where we will add the network directory configuration of the Portainer save data.   

The configuration will be as follows.   

***Indentations (spacing) is strict in YAML, so the indent spaces should be exactly as shown.***

```
volumes:
  portainer_data:
    driver: local
    driver_opts:
        type: nfs4
        o: addr=<ip_address_of_nfs_share_server>,rw
        device: ":<directory_where_portainer_save_data_will_persisted>"
```

My NFS share `ip` address is `10.10.10.0`. (Manager Node VPN address. [VPN setup](#setup-wireguard-vpn-server), [NFS setup](#configure-nfs-server))   
I will be saving the Portainer save data to `/mnt/extdisk/config/portainer`.   

Therefore, I would have the following configuration.   
```
volumes:
  portainer_data:
    driver: local
    driver_opts:
        type: nfs4
        o: addr=10.10.10.0,rw
        device: ":/mnt/extdisk/config/portainer/portainer_shared_data"
```

> Be sure to use the correct number of spaces for indentation in the `.yml` file.

<p align="center">
  <img src="./resources/portainer_agent_stack_yml_file_nfs_volume_added.png" alt="portainer-agent-stack.yml file NFS volume config"/>
</p>

Save the file `Ctrl + S` and exit the editor `Ctrl + X`.

##### Deploy Portainer Stack

Now the Portainer stack can be deployed.    
The command for deploying the stack is given in the online documentation for deploying portainer below the `curl` command.   

```
docker stack deploy -c portainer-agent-stack.yml portainer
```

The variables of this command are `portainer-agent-stack.yml` (the config file) and `portainer` the stack name.
```
docker stack deploy -c <docker_compose_stack_configuration_file> <stack_name>
```

> Ensure you are in the directory of the `portainer-agent-stack.yml` file.

<p align="center">
  <img src="./resources/portainer_deploy_stack_command.png" alt="Deploy Portainer stack"/>
</p>

Both the `portainer_agent` and `portainer_portainer` services will be created, as well as the `portainer_agent_network`.   

To see the services run the following Docker command (Manager node only):
```
docker service ls
```

You should see both services with the correct number of `REPLICAS` (container instances).

> If running for the first time, allow some time for all the nodes in the stack/swarm to download the docker images to be deployed.

I have one Manager node and two server nodes.

<p align="center">
  <img src="./resources/portainer_services_ls.png" alt="Portainer services listed"/>
</p>

For the `portainer_agent` service, the number of `REPLICAS` should be the total number of nodes in the swarm. (Managers and Workers).   
For the `portainer_portainer` service, the number of `REPLICAS` should be the total number of Managers in the swarm.   

The `tasks` (containers in a service) can be viewed using the following Docker command (Manager node only):   
```
docker service ps <service_name>
```

<p align="center">
  <img src="./resources/portainer_services_ps.png" alt="Portainer tasks of services"/>
</p>

In `/mnt/extdisk/config/portainer/portainer_shared_data/` new files and directories should be saved.   
These are the Portainer save data files and directories.   
Running `ls -l` should show they belong to `nobody` and `nogroup` as they are created by deploying the docker container.   

<p align="center">
  <img src="./resources/portainer_persistent_save_data_files.png" alt="Portainer persistent save data files and directories"/>
</p>

The stack can be removed using the following Docker command (Manager node only):   
```
docker stack rm <stack_name>
```

For a stack named `portainer`.   
```
docker stack rm portainer
```

##### Access Portainer GUI

Portainer should now be running.   
The portainer web GUI should be accessible via any node running the `portainer_agent` container.   
As this is all nodes, the Portainer GUI should be accessible using the `ip` address of all the nodes.   

By default portainer serves the web GUI on port `9000` and `9443`.
Port `9000` serves a `http` (non TLS encrypted GUI) web GUI.   
Port `9443` serves a `https` (TLS encrypted GUI; self signed certificate) web GUI.   

Therefore to access Portainer, enter a corresponding `URL` into a browser.   

> You must be connected to the same local network as the server node to access Portainer's web GUI.

The `URL` will be as follows.   
```
<http_or_https>://<server_node_ip_address>:<portainer_gui_port>
```

We will access Portainer via the Manager node, using the `9443` port.   

As my Manager node has a static `ip` address of `192.168.2.100`, the `URL` for accessing Portianer is:
```
https://192.168.2.100:9443
```

I use `https` as port 9443 is TLS encrypted. Portainer responds with a message to use `https`, if we use `http`.

<p align="center">
  <img src="./resources/portainer_gui_access_http_9443.png" alt="Portainer GUI access http with port 9443"/>
</p>

> I can also use `https://srv-node0-rpi4:9443`, as I have `srv-node0-rpi4` set up as the `hostname` and local `DNS` domain name.

Accessing Portainer with `https` on a modern browser will likely give a security warning, this is due to the certificate being self-signed, the browser cannot check legitimacy of the vendor that signed the certificate.   
This is expected, and we can continue to the site.   

TLS/SSL certificates are used for encrypting transmitted data and sometimes also verifying the legitimacy of a website source.   
As we are accessing the a local `ip` address, we can verify the source is legitimate, so we will only be using TLS to encrypt data sent over the local network, the warning can be skipped.   

<p align="center">
  <img src="./resources/portainer_gui_access_cert_warning.png" alt="Portainer GUI access TLS cert warning"/>
</p>

Finally, Portainer will load an interface to get started by creating a user.   

<p align="center">
  <img src="./resources/portainer_gui_access_create_user.png" alt="Portainer GUI access create user"/>
</p>

When logged in the Portainer Dashboard should load.
