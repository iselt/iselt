+++
title = '轻松部署具有动态容器功能的 CTFd 靶场'
date = 2024-04-22T21:10:56+08:00
draft = false
tags = ['CTFd', '靶场搭建']
categories = ['CTF']
+++

## 前言

[CTFd](https://github.com/CTFd/CTFd) 是一个用于举办CTF比赛的平台，它提供了丰富的功能，包括题目管理、用户管理、比赛管理等。

[CTFd-Whale](https://github.com/frankli0324/ctfd-whale) 是一款能够支持题目容器化部署的CTFd插件，它可以让你在 CTFd 中直接部署 Docker 容器作为题目环境，是 CTF Web 题目不可或缺的插件。

由于动态容器对 CPU 和内存要求较高，很多时候会在本地部署 CTFd，并使用 frp 等内网穿透工具将 CTFd 服务映射到公网。

本文将介绍使用由 `Scr1w战队` 二次开发的 CTFd 平台，在本地服务器部署并结合 frp 内网穿透工具，部署具有动态容器功能的 CTFd 靶场。

## 要求

- 1 台本地 Linux 服务器（良好的网络环境）
- 1 台具有公网 IP 的服务器

## 部署 CTFd

### 架构示意图

![20240423131724](https://raw.githubusercontent.com/iselt/ImageBed/main/20240423131724.png)

### 启用 Docker Swarm

#### 创建主节点

```bash
docker swarm init
```

```txt
Swarm initialized: current node (w4...6q) is now a manager.

To add a worker to this swarm, run the following command:

    docker swarm join --token SWMTKN-1-4...p <IP>:2377

To add a manager to this swarm, run 'docker swarm join-token manager' and follow the instructions.
```

#### 加入主节点

在工作节点上执行以下命令：

> 仅一台服务器则无需执行

```bash
docker swarm join --token SWMTKN-1-4...p <IP>:2377
```

#### 查看节点

```bash
docker node ls
```

```txt
ID                            HOSTNAME   STATUS    AVAILABILITY   MANAGER STATUS   ENGINE VERSION
w4neozuaxne7tnk6phd9kyn6q *   debian     Ready     Active         Leader           26.1.0
```

#### 重命名节点

为了之后 CTFd-Whale 的配置方便，我们将节点命名为 `linux-1`。

```bash
docker node update --label-add name=linux-1 <节点 ID>
```

### 安装 frps

#### 下载 frps

<https://github.com/fatedier/frp/releases>

```bash
wget https://github.com/fatedier/frp/releases/download/v0.57.0/frp_0.57.0_linux_amd64.tar.gz
tar -xf frp_0.57.0_linux_amd64.tar.gz
cp -r frp_0.57.0_linux_amd64 CTFd-frps
cd CTFd-frps
```

#### 配置 frps

编辑配置文件

```bash
vim frps.toml
```

```toml
bindAddr = "0.0.0.0"
bindPort = 7897
auth.method = "token"
auth.token = "<yourtoken>"
```

创建服务

```bash
sudo vim /etc/systemd/system/CTFd-frps.service
```

> 根据实际情况更改路径

```ini
[Unit]
Description=CTFd frps
After=network.target

[Service]
Type=simple
ExecStart=/home/iselt/deploy-ctfd/CTFd-frps/frps -c /home/iselt/deploy-ctfd/CTFd-frps/frps.toml
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

启动服务并设置开机自启

```bash
sudo systemctl daemon-reload
sudo systemctl start CTFd-frps
sudo systemctl status CTFd-frps
sudo systemctl enable CTFd-frps
```

### 下载并配置二开版 CTFd

克隆官方仓库到本地

```bash
git clone https://github.com/dlut-sss/CTFd-Public.git
```

修改目录名为 `CTFd`

```bash
mv CTFd-Public CTFd
cd CTFd
```

配置容器内的 frpc

```bash
vim ./conf/frp/frpc.ini
```

```ini
[common]
token=<yourtoken>
server_addr = 172.17.0.1
server_port = 7897
admin_addr = 172.1.0.4
admin_port = 7400
```

启动 compose

```bash
chmod +x docker-entrypoint.sh
docker compose build
docker compose up -d
```

### 查看容器健康状况

```bash
docker ps
```

```txt
CONTAINER ID   IMAGE                     COMMAND                  CREATED          STATUS          PORTS                                       NAMES
20b2eee607f5   ctfd-ctfd                 "/opt/CTFd/docker-en…"   13 seconds ago   Up 11 seconds   0.0.0.0:8000->8000/tcp, :::8000->8000/tcp   ctfd-ctfd-1
1f0a9b695756   mariadb:10.4.12           "docker-entrypoint.s…"   13 seconds ago   Up 12 seconds                                               ctfd-db-1
7a65a0731b09   redis:4                   "docker-entrypoint.s…"   13 seconds ago   Up 12 seconds                                               ctfd-cache-1
1cbf46f42916   shiraikuroko/frp:latest   "/usr/local/bin/frpc…"   13 seconds ago   Up 11 seconds                                               ctfd-frpc-1
7031f9459a6a   shiraikuroko/frp:latest   "/usr/local/bin/frpc…"   13 seconds ago   Up 11 seconds                                               ctfd-compose-frpc-1
```

## 配置 CTFd-Whale

访问当前服务器的 `8000` 端口，进入 CTFd 界面。

完成简单的配置后，进入 `Whale` 插件配置页面`/plugins/ctfd-whale/admin/settings`。

> 这里仅需更改 `自动连接网络` 为 `ctfd_frp_containers` 即可

![20240423134118](https://raw.githubusercontent.com/iselt/ImageBed/main/20240423134118.png)

![20240423134940](https://raw.githubusercontent.com/iselt/ImageBed/main/20240423134940.png)

其他配置内容请查看 <https://github.com/dlut-sss/CTFd-Public>

## 配置公网端口映射

### 云服务器 frps 配置

```bash
wget https://github.com/fatedier/frp/releases/download/v0.57.0/frp_0.57.0_linux_amd64.tar.gz
tar -xf frp_0.57.0_linux_amd64.tar.gz
mv frp_0.57.0_linux_amd64 frps
cd frps
```

```bash
vim frps.toml
```

```toml
bindAddr = "0.0.0.0"
bindPort = 7000
auth.method = "token"
auth.token = "<yourtoken>"
```

创建服务，注意更改路径

```bash
sudo vim /etc/systemd/system/frps.service
```

```ini
[Unit]
Description=frps
After=network.target

[Service]
Type=simple
ExecStart=/root/frps/frps -c /root/frps/frps.toml
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl start frps
sudo systemctl status frps
sudo systemctl enable frps
```

### 本地服务器 frpc 配置

使用先前下载的 frp

```bash
cp -r frp_0.57.0_linux_amd64 frpc
cd frpc
```

编辑配置文件

```bash
vim frpc.toml
```

```toml
serverAddr = "<公网服务器IP>"
serverPort = 7000
auth.method = "token"
auth.token = "<yourtoken>"

# CTFd 平台
[[proxies]]
name = "ctfd"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8000
remotePort = 8000

# http 容器
[[proxies]]
name = "http"
type = "tcp"
localIP = "127.0.0.1"
localPort = 80
remotePort = 80 # 可以根据需要更改

# 直连容器
{{- range $_, $v := parseNumberRangePair "10000-10200" "10000-10200" }}
[[proxies]]
name = "tcp-{{ $v.First }}"
type = "tcp"
localPort = {{ $v.First }}
remotePort = {{ $v.Second }}
{{- end }}
```

创建服务，注意更改路径

```bash
sudo vim /etc/systemd/system/frpc.service
```

```ini
[Unit]
Description=frpc
After=network.target

[Service]
Type=simple
ExecStart=/home/iselt/deploy-ctfd/frpc/frpc -c /home/iselt/deploy-ctfd/frpc/frpc.toml
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

启动服务并设置开机自启

```bash
sudo systemctl daemon-reload
sudo systemctl start frpc
sudo systemctl status frpc
sudo systemctl enable frpc
```

## 云服务器配置 nginx 反向代理

根据域名反向代理不同的端口

例：

- `ctfd.stinger.team` -> `127.0.0.1:8000`
- `ctfd-node.stinger.team` -> `127.0.0.1:80`

```bash
sudo vim /etc/nginx/sites-available/ctfd
```

```nginx
server {
    listen 80;
    server_name ctfd.stinger.team;

    location / {
        proxy_pass http://127.0.0.1:8000;
    }
}

server {
    listen 80;
    server_name ctfd-node.stinger.team;

    location / {
        proxy_pass http://127.0.0.1:80;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ctfd /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 制作题目镜像

参考 [ctf-docker-template](https://github.com/CTF-Archives/ctf-docker-template)

在本地服务器上

```bash
docker build . -t <题目标签>
```

在题目配置中填写该标签即可
