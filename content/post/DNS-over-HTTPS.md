+++
title = '使用 DoH 提升网上冲浪体验'
date = 2024-04-20T11:32:30+08:00
description = '使用 DoH 提升网上冲浪体验，部署自己的 DoH 服务器，避免 DNS 污染。'
draft = false
categories = ['小技巧']
tags = ['网络', 'DNS', 'DoH']

# SEO 相关元数据
keywords = ["DNS over HTTPS", "DoH", "DNS 污染", "DNS 劫持", "CoreDNS", "域名解析", "网络安全", "隐私保护", "VPS", "frp 内网穿透"]
summary = "详细介绍 DNS over HTTPS (DoH) 技术原理，解释 DNS 污染问题及解决方案，提供自建 DoH 服务器的完整教程，包括国内外服务器部署、CoreDNS 配置、证书生成等技术细节。"

# 开放图谱协议 (Open Graph)
[params]
  og_title = "使用 DoH 提升网上冲浪体验 - Iselt Hack Tips"
  og_description = "学习 DNS over HTTPS 技术，自建 DoH 服务器避免 DNS 污染，提升网络访问体验和隐私保护。包含完整的部署教程和技术原理解析。"
  og_type = "article"
+++

## 什么是 DNS 污染

在我们输入域名访问网站的时候，浏览器会先向 DNS 服务器请求解析域名对应的 IP 地址，然后再向该 IP 地址发送请求，获取网站内容。而 DNS 协议是 UDP 的明文、无状态流量，也就是说运营商或者其他中间人（你上网的时候经过的网关、路由器等）都可以看到你的 DNS 请求，并且可以篡改 DNS 响应。

DNS 污染（或称 DNS 劫持）是指某些网络运营商或机构通过篡改 DNS 数据包，将域名解析到错误的 IP 地址，从而使用户无法访问正确的网站。这种攻击手段通常是为了实现网络审查、封锁特定网站或进行其他恶意目的。简单来说，当你在访问某个网址时，DNS 污染会导致你被错误地引导到不同的网站，而不是你本来想要访问的网站。如果你遇到访问问题，可能是因为 DNS 污染导致的。

维基百科：[域名服务器缓存污染](https://zh.wikipedia.org/wiki/%E5%9F%9F%E5%90%8D%E6%9C%8D%E5%8A%A1%E5%99%A8%E7%BC%93%E5%AD%98%E6%B1%A1%E6%9F%93)

## 如何避免 DNS 污染

根据上述原理，想要避免 DNS 污染，一种办法就是给 DNS 协议加密，使中间人无法识别或篡改 DNS 请求。

加密 DNS 技术有很多种，其中最常见的是 DNS over HTTPS（DoH）和 DNS over TLS（DoT）。而目前 DoH 技术已经被主流浏览器和操作系统支持，用户可以直接在浏览器或系统设置中开启 DoH 功能，从而避免 DNS 污染。

DNS over HTTPS（DoH）走的是网站常用的 HTTS 协议，既能很好的加密流量，也能作为伪装，还有良好的支持性。

DoH 服务器的原理就是开启一个 Web API 接口（一般为 `https://<domain>/dns-query` ），DNS 客户端查询域名记录时，需要向这个接口 `GET` 传参，参数名为 `name` ，值为域名，服务器返回含有该域名对应的 IP 地址的 JSON 数据，DNS 客户端解析 JSON 数据即可。

维基百科：[DNS over HTTPS](https://en.wikipedia.org/wiki/DNS_over_HTTPS)

## DoH 服务器

开启浏览器或操作系统的 DoH 功能需要选择一个 DoH 服务器。目前有很多公共的 DoH 服务器，用户可以直接使用。比如：

- [阿里云公共 DNS](https://alidns.com/)
- [Cloudflare](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/encrypted-dns-browsers/)
- [DNSPod Public DNS](https://docs.dnspod.cn/public-dns/dot-doh/)
- [Google Public DNS](https://developers.google.com/speed/public-dns/docs/doh?hl=zh-cn)
- ...

但是这些 DoH 服务都有一些问题：

1. 国内的服务器会使用黑名单机制，很大程度上和使用普通的 DNS 没有区别
2. 国外的服务器速度太慢或者根本连不上，不适合国内用户使用

因此，我们可以自己搭建一个 DoH 服务器，既能保证隐私，提高网上冲浪体验，又能有更好的访问速度。

## 我的 DoH 服务器

我搭建了一个优化后的 DoH 服务器：`https://doh.iselt.top/dns-query`，针对国内域名，使用阿里云公共 DNS 加快请求速度；针对国外域名，使用加密 DNS 获取准确的 IP 地址。欢迎读者使用。

## 搭建自己的 DoH 服务器

> 搭建过程较为繁琐且成本较高，仅供参考

这里的 DNS 服务器并不是指真正的 DNS 服务器，而是一个开启 DoH 服务的中转服务器，接收 DoH 请求，再向真正的 DNS 服务器获取域名记录。因此，首先我们需要的是一个干净的 DNS 服务，而这就要求我们有一台国外的 VPS，并且延迟越低越好，否则和直接使用公共 DoH 服务器没有区别。目前我买到延迟最低的是 CMI 线路的香港 VPS，移动线路直连，延迟在 30ms 左右。

> <https://www.bandwagonhost.net/14338.html> 搬瓦工移动 CMI 路线，对应的是香港 HK85 机房。但是目前这个机房只有在香港 CMI 限量版套餐、THE PLAN 限量版套餐中才能使用，而这些套餐目前都已经缺货下架了，所以还能不能买到还是个问题（一般是一年上架几天），如果能买到的话，也是非常推荐移动用户购买使用的。

当然，30ms 和国内的 DoH 服务器相比还是有很大差距的，所以我们可以在国内搭建一个中转服务器，用于缓存和分流，如果是国内的域名，直接就近请求即可，如果是国外域名，则请求国外 DNS 服务器。

### 国外服务器

针对 DNS 中转服务，我们可以使用 [CoreDNS](https://github.com/coredns/coredns)。

这台服务器用于国内服务器的 DNS 请求，由于要跨境，所以需要部署加密的 DNS 服务。但是由于 CoreDNS 不支持 DoH ，所以我们使用 DoT，这样也不用部署 Web 中间件了。

#### 1. 自签证书

##### 1. 准备配置文件

首先，你需要准备一个配置文件，以便在生成证书时包含SAN（例如DNS名称和IP地址）。创建一个名为 `openssl.cnf` 的文件，内容如下所示。

```cnf
[ req ]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext

[ dn ]
C = US
ST = California
L = San Francisco
O = My Company
OU = My Division
CN = core.dns.my

[ req_ext ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = core.dns.my

[ v3_ca ]
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid:always,issuer
basicConstraints = critical,CA:true
keyUsage = critical, digitalSignature, cRLSign, keyCertSign
```

##### 2. 生成CA的私钥

运行以下命令生成CA的私钥(ca.key)：

```bash
openssl genrsa -out ca.key 4096
```

##### 3. 生成CA的自签名证书

使用你刚才创建的私钥和配置文件，生成CA的自签名证书(ca.crt)：

```bash
openssl req -x509 -new -nodes -key ca.key -sha256 -days 36500 -out ca.crt -config openssl.cnf
```

##### 4. 生成服务器的私钥

为你的服务器生成一个私钥(server.key)：

```bash
openssl genrsa -out server.key 2048
```

##### 5. 生成证书签名请求(CSR)

使用服务器的私钥和配置文件生成一个CSR(server.csr)：

```bash
openssl req -new -key server.key -out server.csr -config openssl.cnf
```

##### 6. 使用CA签发带SAN的服务器证书

最后，使用你的CA签发服务器的证书(server.crt)：

```bash
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 36500 -sha256 -extfile openssl.cnf -extensions req_ext
```

现在，你应该有了一套完整的证书密钥对，包括CA的自签名证书(`ca.crt`)、服务器的私钥(`server.key`)和服务器的证书(`server.crt`)。

需要修改一下 `server.key` 的权限让其他用户对它可读

```bash
chmod 644 server.key
```

#### 部署 CoreDNS

在 `./coredns` 文件夹中，需要有如下内容

1. [CoreDNS](https://github.com/coredns/coredns) 可执行文件

2. `cert` 文件夹放置刚才生成的三个密钥对和证书文件

3. `Corefile` 配置文件，内容如下

> 由于 GFW 可能会封锁 853 端口, 设置为 8553 端口

```txt
.:53 {
    forward . tls://1.1.1.1:853 {
        tls_servername one.one.one.one
        force_tcp
        max_fails 2
    }
    cache 120
    reload 10s
    log
    errors
}
tls://.:8553 {
    tls /etc/coredns/cert/server.crt /etc/coredns/cert/server.key /etc/coredns/cert/ca.crt
    forward . 127.0.0.1:53
}
```

这是当前的目录结构：

```txt
.
├── cert
│   ├── ca.crt
│   ├── ca.key
│   ├── ca.srl
│   ├── openssl.cnf
│   ├── server.crt
│   ├── server.csr
│   └── server.key
├── coredns
└── Corefile
```

使用 `./coredns -conf Corefile` 命令启动 CoreDNS 服务，出现如下输出即为成功

```txt
.:53
tls://.:8553
[INFO] plugin/reload: Running configuration SHA512 = 7b...18
CoreDNS-1.11.1
linux/amd64, go1.20.7, ae2bbc2
```

可以使用如下文件注册为服务

`/etc/systemd/system/coredns.service`

```service
[Unit]
Description=CoreDNS Server
After=network.target
Restart=on-failure
RestartSec=10

[Service]
WorkingDirectory=/root/coredns
ExecStart=/root/coredns/coredns -conf Corefile
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload # 重新加载配置文件
systemctl start coredns # 启动服务
systemctl enable coredns # 开机自启
```

### 国内服务器

#### 部署 CoreDNS

首先将国外服务器的 `ca.crt`, `server.key`, `server.crt` 文件放到国内服务器的 `./coredns/cert` 文件夹中

由于我们要使用国内域名分流功能，需要前往 [修改版CoreDNS配置文件生成器](https://coredns.minidump.info/) 配置并下载魔改版 CoreDNS

配置推荐如下

- 国内 DNS 可以选择阿里云公共 DNS
- 国外 DNS 随便选一个 tls 的就行，我们待会要改成自己的
- 取消勾选广告插件相关的两个选项，我这边会报错
- 监听地址添加 `:53`

生成配置文件，上传到服务器。

修改 `Corefile` 文件，跳转至末尾的配置块，修改为如下内容

```txt
.:53001 {
    bind 127.0.0.1
    forward . tls://<你的国外服务器IP地址>:8553 {
        tls_servername core.dns.my
        tls ./cert/server.crt ./cert/server.key ./cert/ca.crt
    }
    cache 3600
    reload 10s
}
```

下载该网页下方的对应系统的 CoreDNS ，将可执行文件解压后上传到服务器。

此时目录结构如下

```txt
.
├── cert
│   ├── ca.crt
│   ├── server.crt
│   └── server.key
├── coredns
└── Corefile
```

使用 `./coredns -conf Corefile` 命令启动 CoreDNS 服务，出现如下输出即为成功

```txt
.:53
.:53001 on 127.0.0.1
[INFO] plugin/reload: Running configuration SHA512 = 64..f4
CoreDNS-1.11.2
linux/amd64, go1.21.8, 8de4531-dirty
```

可以使用如下文件注册为服务

`/etc/systemd/system/coredns.service`

```service
[Unit]
Description=CoreDNS Server
After=network.target
Restart=on-failure
RestartSec=10

[Service]
WorkingDirectory=/root/coredns
ExecStart=/root/coredns/coredns -conf Corefile
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload # 重新加载配置文件
systemctl start coredns # 启动服务
systemctl enable coredns # 开机自启
```

#### 部署 DoH-Server

> 由于我的服务器使用了多站点反代, 因此需要部署一个 DoH 服务器, 但是其实 CoreDNS 本身是支持 DoH 的, 只需要在配置文件中添加 `https://` 的监听并配置 `tls` 证书即可, 具体可查阅官方文档.

这里我们使用简单的 `docker compose` 部署

```yml
version: '2.2'
networks:
  default:

services:
  doh-server:
    image: satishweb/doh-server
    hostname: doh-server
    networks:
      - default
    ports:
      - "8053:8053" # 容器内端口需与下方配置对应
    restart: unless-stopped
    environment:
      DEBUG: "0"
      # Upstream DNS server: proto:host:port
      # We are using OpenDNS DNS servers as default,
      # Here is the list of addresses: https://use.opendns.com/
      UPSTREAM_DNS_SERVER: "udp:172.17.0.1:53"
      DOH_HTTP_PREFIX: "/dns-query"
      DOH_SERVER_LISTEN: ":8053" # DoH Server 服务监听端口 (HTTP)
      DOH_SERVER_TIMEOUT: "10"
      DOH_SERVER_TRIES: "3"
      DOH_SERVER_VERBOSE: "true"
      # You can add more variables here or as docker secret and entrypoint
      # script will replace them inside doh-server.conf file
      #volumes:
      # - ./doh-server.conf:/server/doh-server.conf
      # Mount app-config script with your customizations
      # - ./app-config:/app-config
    deploy:
      replicas: 1
      # placement:
      #   constraints:
      #     - node.labels.type == worker
```

#### 配置反代

这里我使用的是 [`nginx proxy manager`](https://github.com/xiaoxinpro/nginx-proxy-manager-zh/), 有 Web UI 界面, 并支持自动注册和更新证书, 具体配置不在此赘述, 可自行查阅文档.

#### 测试

至此我们的 DoH 服务器已经搭建完成, 使用 `curl` 测试一下

```bash
# 国外域名
$ time curl https://doh.iselt.top/dns-query?name=facebook.com
{"Status":0,"TC":false,"RD":true,"RA":true,"AD":false,"CD":false,"Question":[{"name":"facebook.com.","type":1}],"Answer":[{"name":"facebook.com.","type":1,"TTL":56,"Expires":"Sat, 20 Apr 2024 15:04:48 UTC","data":"157.240.199.35"}]}
real    0m0.094s
user    0m0.013s
sys     0m0.000s
```

```bash
# 国内域名
$ time curl https://doh.iselt.top/dns-query?name=baidu.com
{"Status":0,"TC":false,"RD":true,"RA":true,"AD":false,"CD":false,"Question":[{"name":"baidu.com.","type":1}],"Answer":[{"name":"baidu.com.","type":1,"TTL":112,"Expires":"Sat, 20 Apr 2024 15:06:12 UTC","data":"110.242.68.66"},{"name":"baidu.com.","type":1,"TTL":112,"Expires":"Sat, 20 Apr 2024 15:06:12 UTC","data":"39.156.66.10"}]}
real    0m0.049s
user    0m0.013s
sys     0m0.000s
```

可以看到速度还是很快的, 且国外域名经过缓存后可以达到和国内域名一样的速度.

```bash
$ time curl https://doh.iselt.top/dns-query?name=facebook.com
{"Status":0,"TC":false,"RD":true,"RA":true,"AD":false,"CD":false,"Question":[{"name":"facebook.com.","type":1}],"Answer":[{"name":"facebook.com.","type":1,"TTL":43,"Expires":"Sat, 20 Apr 2024 15:06:04 UTC","data":"163.70.158.35"}]}
real    0m0.044s
user    0m0.013s
sys     0m0.000s
```
