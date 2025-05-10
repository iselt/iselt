---
title: "为 WSL2 编译自定义内核并启用 USB 无线网卡支持（MT7921U）"
date: 2025-05-11T01:23:00+08:00
math: false
tags: [
    'WSL',
    "WiFi",
    'Linux',
    'Linux内核',
    'MT7921U'
]
categories: ['小技巧']
---

## 背景介绍

在 WSL2 环境中使用 USB 无线网卡，主要有以下几个驱动因素：

1.  **资源效率与便捷性**：相较于完整的虚拟机方案，WSL2 更为轻巧，避免了额外虚拟化层的开销。对于希望在 Linux 环境下进行无线网络操作，又不愿负担完整虚拟机资源占用的用户而言，这是一个理想的选择。
2.  **特定应用场景需求**：尤其对于网络安全研究人员或开发者，他们可能需要在 WSL2 内运行的 Kali Linux 等发行版中直接访问和控制无线网卡，以进行 WiFi 渗透测试、网络嗅探、数据包注入或开发基于 WiFi 的应用。原生驱动的 USB 网卡能提供更底层的硬件访问能力和更佳的性能。
3.  **利用现有 Linux 生态**：许多 USB 无线网卡（如本文中的 MT7921U）在 Linux 内核中已经拥有成熟的驱动支持。通过内核编译，可以将这些驱动集成到 WSL2 的 Linux 环境中，充分利用 Linux 强大的网络功能和丰富的工具链。

尽管 WSL2 提供了强大的 Linux 兼容性，但对于 USB 无线网卡的直接支持并非开箱即用，主要面临以下挑战：

1.  **内核版本与驱动限制**：WSL2 默认提供的 Linux 内核版本可能较旧（例如，在某些时期稳定版内核为 5.15.x 系列）。对于一些较新的无线网卡芯片组（如 MediaTek MT7921 系列），其驱动可能需要更新的内核版本（如 5.18 或更高版本）才包含或完善支持。因此，直接在旧版内核上使用这些新网卡可能会遇到驱动缺失或不兼容的问题。
2.  **USB 设备转发机制**：虽然 Windows 提供了 `usbipd-win` 工具，可以将物理 USB 设备从 Windows 主机转发到 WSL2 虚拟机中，但这仅仅解决了设备连接的问题。WSL2 内的 Linux 系统仍然需要相应的驱动程序才能识别和使用该 USB 设备。如果内核中没有包含特定无线网卡的驱动模块，即使设备成功转发，也无法正常工作。

因此，为了在 WSL2 中成功使用像 MT7921U 这样的 USB 无线网卡，通常需要用户手动编译包含相应驱动模块的 WSL2 内核，并进行正确的配置。本文将以 MT7921U 无线网卡为例，详细介绍这一过程。

## 过程

### 安装固件

由于某些原因系统无法识别固件文件

```log
[   10.101267] mt7921u 2-1:1.0: Direct firmware load for mediatek/WIFI_RAM_CODE_MT7961_1.bin failed with error -2
[   10.421071] mt7921u 2-1:1.0: Direct firmware load for mediatek/WIFI_MT7961_patch_mcu_1_2_hdr.bin failed with error -2
```

因此内核编译过程中需要将固件编译进内核，需要先安装 mt7921 的固件

```bash
sudo apt install firmware-mediatek
```

- mediatek/WIFI_RAM_CODE_MT7961_1.bin
- mediatek/WIFI_MT7961_patch_mcu_1_2_hdr.bin

也可以去[linux存储库](https://git.kernel.org/pub/scm/linux/kernel/git/firmware/linux-firmware.git/tree/mediatek)上下载上述的驱动程序并放置在 `/lib/firmware/mediatek/` 目录下


### 内核编译

> 参考资料
> <https://github.com/microsoft/WSL2-Linux-Kernel>、
> <https://gist.github.com/fOmey/33b0e8b2b492bacd1a0839e929ecffea>

#### 依赖项

```bash
sudo apt update && sudo apt upgrade

sudo apt install flex bison libssl-dev libelf-dev git dwarves bc make libncurses-dev python3
```

#### 拉取内核源码并解压

确保你不在一个 /mnt/c 路径中（读写速度会非常慢）

```bash
cd ~
```

从<https://github.com/microsoft/WSL2-Linux-Kernel/releases/>获取最新支持的内核版本

```bash
export WSL_KERNEL_VERSION=6.6.87.1
wget https://github.com/microsoft/WSL2-Linux-Kernel/archive/refs/tags/linux-msft-wsl-$WSL_KERNEL_VERSION.tar.gz
tar -xvf linux-msft-wsl-$WSL_KERNEL_VERSION.tar.gz
```

更换目录到内核源码

```bash
cd WSL{TAB}
```

#### 修改 WSL2 内核配置

```bash
make menuconfig KCONFIG_CONFIG=Microsoft/config-wsl
```

进行以下修改

**1. 将固件编译进内核**

- Device Drivers
    - Generic Driver Options
        - Firmware loader
            - Build named firmware blobs into the kernel binary

输入
```txt
mediatek/WIFI_RAM_CODE_MT7961_1.bin mediatek/WIFI_MT7961_patch_mcu_1_2_hdr.bin
```
并按回车

确认 `Firmware blobs root directory` 的值为 `/lib/firmware`

**2. 启用驱动支持**

- Device Drivers
    - Network device support
        - Wireless LAN
            - MediaTek devices
                - `<M>` MediaTek MT7921U (USB) support

`M`表示编译为模块，后续我们会进行配置以加载

**3. 将 `cfg80211` 和 `mac80211` 编译进内核**

- Networking support
    - Wireless
        - `<*>` cfg80211 - wireless configuration API
        - `<*>` Generic IEEE 802.11 Networking Stack (mac80211) 

`*` 表示编译进内核，默认为 `M`

**4. 保存并退出**

向右移动到`<Save>`进行保存，然后退出

#### 编译

```bash
make KCONFIG_CONFIG=Microsoft/config-wsl -j$(nproc)
```

`-j$(nproc)`表示调用所有CPU核心进行编译

#### 导出内核

替换 `USERNAME` 为你的自己的用户名

```bash
mv arch/x86/boot/bzImage /mnt/c/Users/USERNAME
```

### 配置 WSL

#### 启用 systemd，用于模块自动启动 & 其他有用的服务

```bash
sudo vim /etc/wsl.conf
```

内容：

```conf
[boot]
systemd = true
```

#### 启用 WiFi 网卡驱动模块

写入 `/etc/modules-load.d` 以进行开机自动加载

```bash
echo "mt7921u" | sudo tee -a /etc/modules-load.d/mt7921u.conf
```

> 手动加载模块的命令：`sudo modprobe mt7921u`

#### 关机

在 Windows 上

```cmd
wsl --shutdown
```

在 %UserProfile% 创建/修改 .wslconfig 文件

```conf
[wsl2]
kernel=C:\\Users\\USERNAME\\bzImage
```

其他配置可参考：<https://learn.microsoft.com/en-us/windows/wsl/wsl-config#configure-global-options-with-wslconfig>

#### 重启并安装内核模块

在 Windows 上

```cmd
wsl
```

进入Linux后安装内核模块

```bash
cd ~/WSL{TAB}
make INSTALL_MOD_PATH="$PWD/modules" modules_install
```



验证内核模块是否加载

```bash
lsmod
```

输出：

```bash
Module                  Size  Used by
mt7921u                16384  0
mt7921_common          73728  1 mt7921u
mt792x_lib             61440  2 mt7921_common,mt7921u
mt76_connac_lib        86016  3 mt792x_lib,mt7921_common,mt7921u
mt792x_usb             12288  1 mt7921u
mt76_usb               40960  2 mt792x_usb,mt7921u
mt76                  118784  6 mt792x_lib,mt792x_usb,mt76_usb,mt7921_common,mt76_connac_lib,mt7921u
```

### 连接 USB

参考：<https://learn.microsoft.com/zh-cn/windows/wsl/connect-usb>，官方文档写的很详细，此处不再赘述

```bash
lsusb
```

```bash
Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub
Bus 002 Device 001: ID 1d6b:0003 Linux Foundation 3.0 root hub
Bus 002 Device 003: ID 0e8d:7961 MediaTek Inc. Wireless_Device
```

```bash
lsusb -t
```

```bash
/:  Bus 001.Port 001: Dev 001, Class=root_hub, Driver=vhci_hcd/8p, 480M
/:  Bus 002.Port 001: Dev 001, Class=root_hub, Driver=vhci_hcd/8p, 5000M
    |__ Port 001: Dev 003, If 0, Class=Vendor Specific Class, Driver=mt7921u, 5000M
```

显示 `Driver=mt7921u` 则说明驱动正确加载并识别设备

```bash
dmesg | grep mt7921u
```

```
[    1.564651] usbcore: registered new interface driver mt7921u
[  122.874131] mt7921u 2-1:1.0: HW/SW Version: 0x8a108a10, Build Time: 20241106151007a
[  122.889820] mt7921u 2-1:1.0: WM Firmware Version: ____010000, Build Time: 20241106151045
```

获得如上输出则说明固件正常写入设备，可以正常运行

```bash
iwconfig
```

```bash
wlan0     IEEE 802.11  ESSID:off/any
          Mode:Managed  Access Point: Not-Associated
          Retry short limit:7   RTS thr:off   Fragment thr:off
          Power Management:on
```

成功！