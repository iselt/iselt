---
title: "剖析 Kerberos | Kerberos 认证层攻击"
date: 2024-09-05T14:52:25+08:00
math: false
tags: [
    'Windows',
    "Active Directory",
    'Kerberos',
]
categories: ['漏洞研究']
---

> 翻译自：[Unmasking Kerberos | Attacking the Kerberos Authentication Layer](https://medium.com/@zaikoarg/unmasking-kerberos-attacking-the-kerberos-authentication-layer-7c05a6efa52b)
>
> 原作者：[Luciano Pereira](https://medium.com/@zaikoarg)

## 专有名词缩写及中文

- **KDC**：Key Distribution Center，密钥分发中心。
- **TGT**：Ticket Granting Ticket，票证授权票据。
- **TGS**：Ticket Granting Service，票证授权服务。
- **TGS**：Ticket Granting Server，票证授权服务器。
- **ST**：Service Ticket，服务票据。
- **AS**：Authentication Service，认证服务。
- **PAC**：Privilege Attribute Certificate，权限属性证书。
- **UPN**：User Principal Name，用户主体名称。
- **SPN**：Service Principal Name，服务主体名称。
- **SID**：Security Identifier，安全标识符。
- **RID**：Relative Identifier，相对标识符。

## 引言

大家好，我是 Luciano Pereira，也被称为 ZaikoARG。今天，我邀请你们深入探索另一篇文章，我们将探讨 Kerberos 认证及其潜在威胁的迷人世界。

这篇文章的目的，与我大多数写作一样，是提供深入的理解。除了学习如何利用我们将讨论的漏洞，我的目标是让你们理解其基本原理。这种理解将为你们带来显著的优势，比如提高横向思维、磨练直觉以及增强在不同攻击场景下的适应能力。

我想明确的是，这篇文章不会提供关于执行攻击的具体命令的说明。在我看来，这些攻击已经非常广为人知，互联网上有很多网站可以轻松找到所需的指令。我的主要目标是专注于解释这些漏洞的工作原理，因为这是我在这篇文章中想要强调的内容。

## Kerberos 认证层

为了全面理解本文中将讨论的每个漏洞，我们必须对 Kerberos 认证层的运作机制和认证流程有扎实的理解。接下来，我们将探讨一些基础概念，这些概念为我们的理解奠定了基础，比如：什么是 Kerberos？以及 Kerberos 中的基本认证流程是如何工作的？

## 什么是 Kerberos？

Kerberos 是一种广泛使用的网络协议，主要应用于 Windows 系统中，用于网络中的用户和服务身份验证。Kerberos 的认证过程通过加密票证操作，票证包括票证授权票据（Ticket Granting Ticket，TGT）和服务授权票据（Ticket Granting Service，TGS 或 ST）。

## 什么是密钥分发中心（Key Distribution Center, KDC）？

密钥分发中心（KDC）是 Kerberos 认证和授权协议中的一个核心组件。其主要功能是管理和分发访问票据，增强用户和服务在网络中的身份验证安全性。

KDC 主要由两个部分组成：

- **认证服务（Authentication Service, AS）**：这是用户在系统中进行身份验证时首先与之通信的组件。它负责验证用户身份并颁发票证授权票据（Ticket Granting Tickets, TGT）。
- **票证授权服务器（Ticket Granting Server, TGS）**：这是用户获得 TGT 后与之通信的第二个组件。客户端通过 AS 获取 TGT 后，TGS 验证 TGT 并颁发服务票据（Service Tickets, STs），允许用户访问特定服务。

## TGT 和 TGS 结构

### 票证授权票据（Ticket Granting Ticket, TGT）

当用户在网络上进行身份验证时，他们与 Kerberos 认证服务（具体是密钥分发中心, KDC）进行通信。KDC 颁发一个 TGT 并由客户端保存。TGT 是一个加密的票证，包含已认证用户的信息以及一个临时会话密钥，称为 TGS 会话密钥（TGS Session Key）。

**TGT 内容**：TGT 包括用户名称、认证服务器名称、时间戳和 TGS 会话密钥。最初，这个 TGT 由 KDC 主密钥加密（KDC Master Key，该密钥实际上源自 KRBTGT 这个用户的账户密钥），然后使用用户主密钥加密（User Master Key，源自用户密码）。

### 票证授权服务（Ticket Granting Service, TGS）或服务票据（Service Ticket, ST）

当用户希望访问网络资源（如文件服务器）时，他们从 KDC（具体是票证授权服务器， Ticket Granting Server）请求 ST。ST 是一个加密票证，允许用户访问特定资源。

**ST 内容**：ST 包含用户信息、资源服务器信息、时间戳和会话密钥，并由资源服务器的密钥加密。

## 什么是 PAC（权限属性证书）？

PAC，代表权限属性证书（Privilege Attribute Certificate），是 TGT（Ticket Granting Ticket, 票证授权票据）中的一个重要组件，用于存储关于用户权限的附加信息。PAC 包含用户的组成员身份以及其他安全属性信息。

**PAC 验证（PAC Validation）**：PAC 验证是一个验证 PAC 中信息合法性的过程，确保用户在授予访问权限之前具有正确的权限。

## Kerberos 认证流程

Kerberos 认证使用一种称为“票证（tickets）”的令牌系统，并同时采用加密技术保护数据包，防止它们被读取或篡改。

当用户希望访问网络上的资源或服务时，Kerberos 认证流程启动。Kerberos 认证流程在用户成功获取票证授权服务（TGS）或服务票据（ST）后完成，允许用户对服务进行身份验证并使用该服务。

![Kerberos 认证流程图](https://gh.iinx.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240905132717.png)

### 1. KRB_AS_REQ：向认证服务（AS）请求 TGT

客户端通过向认证服务（Authentication Service, AS）提供用户的用户主体名称（User Principal Name, UPN）和时间戳，来请求票证授权票据（Ticket Granting Ticket, TGT）。此外，客户端还会发送“预认证（Pre-Authentication）”信息，其中包含使用客户端密钥加密的时间戳和一次性使用的随机数（a one-time-used number, nonce）。

### 2. KRB_AS_REP：从认证服务获取 TGT

在此步骤中，KDC（具体是认证服务，AS）会检查用户请求中的 UPN 是否在其数据库中。然后，它会使用用户的哈希密码来解密和验证预认证信息。

确保客户端和 KDC 的时钟同步非常重要，时间戳必须在可接受的范围内。如果预认证验证成功且时间戳有效，则认证完成。

此时，KDC（具体是认证服务）会颁发 TGT（票证授权票据）。在该 TGT 中，存储了 TGS 会话密钥（Ticket Granting Server Session Key）。此密钥将在后续步骤中用于加密和解密与 TGS（票证授权服务器）的通信。

TGT 首先用 KDC 主密钥加密，然后再次用用户主密钥加密。最后，它作为 Kerberos 授权服务响应（KRB_AS_REP）的一部分发送给客户端。

### 3. KRB_TGS_REQ：提交 TGT 并请求 TGS

客户端向 KDC（具体是票证授权服务器）提交 TGT，同时发送要访问的服务的 SPN（服务主体名称）。该请求使用之前获取的 TGS 会话密钥加密。

### 4. KRB_TGS_REP：从 KDC 获取 TGS

KDC（具体是票证授权服务器）尝试验证 TGT。如果验证成功，它会生成一个包含请求者信息（例如其 SID 和所属组）的 TGS。此服务票据使用服务的密码哈希加密。

服务票据和会话密钥会再次使用 TGS 会话密钥加密，并发送给客户端。

### 5. KRB_AP_REQ：向应用服务器提交 TGS 进行授权

客户端将从 KDC 接收到的 TGS 发送给应用服务器，同时附上一条使用服务会话密钥加密的认证消息。

### 6. KRB_AP_REP：应用服务器授予客户端服务访问权限（Client Access）

应用服务器接收消息，并使用服务会话密钥解密。

应用服务器从服务票据中提取权限属性证书（PAC），并向域控制器验证其内容（PAC 验证）。只有当 TGT 超过 20 分钟时，票据和 PAC 验证才会发生。

## Kerberos 认证攻击

既然我们已经了解了 Kerberos 身份验证系统的运行方式，下面我们将深入探讨 Kerberos 身份验证系统中存在的大量漏洞和攻击。

如前所述，Kerberos 身份验证流程包括 6 个步骤。 接下来，我们将根据 Kerberos 身份验证流程中出现攻击和漏洞的步骤，逐一解释这些攻击和漏洞。

### 1. AS-REP Roast 攻击

![AS-REP Roast 攻击示意图](https://gh.iinx.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240905135731.png)

> Kerberos 认证流程步骤：*2. KRB_AS_REP：从认证服务获取 TGT*

AS-REP Roast 攻击是基于在不提前知道用户密码的情况下获取票证授权票据（TGT）。域中名为 UF_DONT_REQUIRE_PREAUTH 的特殊属性使这种攻击成为可能。

#### UF_DONT_REQUIRE_PREAUTH 属性的工作原理

如前所述，在传统的 Kerberos 认证过程中，尤其是在第一步（KRB_AS_REQ）中，客户端向 KDC（认证服务）发送请求获取 TGT。在该请求中，包含用户主体名称（UPN）、时间戳和预认证数据，这些数据使用用户密码哈希进行加密后发送。

当用户被分配了 **UF_DONT_REQUIRE_PREAUTH** 属性时，这会告知 KDC（认证服务）无需预认证即可请求 TGT（票证授权票据）。这允许客户端在不知晓用户密码的情况下代表该用户请求 TGT。

#### 对 TGT 进行暴力破解

之前我们描述了 TGT 的组成。现在，我们将深入了解如何对 TGT 进行暴力破解攻击。

正如之前所提到的，在 AS-REP 阶段，密钥分发中心（KDC）会提供一个 TGT，且该 TGT 经过两次加密：

1. 第一次用 KDC 主密钥加密，该密钥源自服务账户 KRBTGT 的密码。
2. 第二次用用户主密钥重新加密，该密钥源自请求 TGT 的用户密码。

在合法客户端的典型情况下，客户端会使用自己的密码解密 TGT 以获取 TGS 会话密钥。然而，在攻击者不知晓请求 TGT 用户的密码的情况下，攻击者会尝试通过离线字典式暴力破解来解密 TGT。如果攻击者成功解密 TGT，意味着他们已经获得了用户的密码。

### 2. 黄金票据攻击（Golden Ticket Attack）

![黄金票据攻击示意图](https://gh.iinx.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240905140852.png)

> Kerberos 认证流程步骤：*2. KRB_AS_REP：从认证服务获取 TGT*

“黄金票据攻击”是一种通过生成伪造的 TGT（票证授权票据）来实现的攻击，攻击者可以将其提交给 TGS（票证授权服务器），以请求域内任何服务的服务票据，并可以冒充域内的任何用户。

#### 黄金票据攻击的工作原理

“黄金票据攻击”的基础是掌握 KRBTGT 服务账户的凭据，该账户负责管理 Kerberos 服务。为了理解这一攻击，回顾之前介绍的 Kerberos 流程非常重要。

当用户从密钥分发中心（KDC）请求 TGT 时，他们会通过 KRB_AS_REQ 发送请求。服务器响应 KRB_AS_REP，其中包含两次加密的 TGT。第一次加密使用 KDC 主密钥，该密钥源自 KRBTGT 账户的密码。第二次加密使用用户主密钥，该密钥源自请求 TGT 的用户密码。

第一次加密保护整个 TGT，确保没有人可以在不知道 KDC 主密钥的情况下修改它。第二次加密则是为了确保 TGT 在传输过程中的安全。如果攻击者截获了通信，他们需要知道用户的主密钥才能查看 TGT。

当用户解密 KRB_AS_REP 时，他们获得了 TGT 和 TGS 会话密钥，该密钥用于加密与票证授权服务器（TGS）的通信，以请求服务票据。

当用户发送 KRB_TGS_REQ 请求服务票据时，TGS 会尝试使用 KDC 主密钥解密 TGT。一旦解密成功，TGS 可以访问票据中的信息，如 TGT 所属用户及其所属组。TGS 验证用户后，为该用户颁发服务票据。

然而，攻击者如果掌握了域中 KRBTGT 账户的凭据，就可以计算出 KDC 主密钥，并解密 TGT。掌握这些信息后，攻击者可以使用模板创建伪造的 TGT，指定其属于任何域用户，设置有效期，并使用计算出的 KDC 主密钥加密。当攻击者发送伪造的 TGT 作为 KRB_TGS_REQ 时，票证授权服务器会收到该票据，并因为它是用 KDC 主密钥加密的，可以毫无问题地解密并为伪造的用户颁发服务票据。

简而言之，这允许攻击者在域内的任何服务上冒充任何域用户。

#### 创建伪造的 TGT

要执行黄金票据攻击，必须创建一个伪造的 TGT。为此，攻击者需要掌握以下信息：

- **KRBTGT 服务账户的 NTLM 哈希**：这是 Kerberos 服务账户，用于加密和解密 TGT（票证授权票据）。
- **域的安全标识符（SID）**：这是该域的唯一标识符，在创建安全令牌时使用，并且在计算伪造 TGT 中的 PAC（权限属性证书）时至关重要。PAC 包含安全组和用户权限信息，准确的 PAC 生成依赖于域的 SID。

拥有这些信息后，攻击者可以生成一个看似真实有效的伪造 TGT，用于访问受损域内的资源和系统，从而导致未授权访问敏感系统和权限提升。

### 3. Kerberoasting 攻击

#### Kerberoasting 攻击的发现

Kerberoasting 攻击由 Tim Medin 于 2014 年在 DerbyCon 上首次提出。这类攻击发生在攻击者已经成功进入企业网络，并且完成了必要的侦查工作，准备进行横向移动时。

#### Kerberos 认证流程

正如我们之前解释 Kerberos 认证流程时所描述的那样，请求服务票据（Service Ticket）需要具备已存在的票证授权票据（TGT）和票证授权服务（TGS）会话密钥。一旦这些要素到位，攻击者可以通过向票证授权服务器（TGS）发送 KRB_TGS_REQ 请求服务票据。在该请求中，TGT 和目标服务的服务主体名称（Service Principal Name, SPN）一起被发送。这些通信都使用 TGS 会话密钥加密。票证授权服务器验证信息后，会在 KRB_TGS_REP 响应中返回一个使用服务账户的 NTLM 哈希加密的服务票据。

#### Kerberoasting 攻击

Kerberoasting 攻击基于攻击者为特定 SPN 申请服务票据的能力，他们有可能破解该票据。

#### 什么是 Kerberoastable 用户？

需要强调的是，Kerberoasting 攻击主要针对由用户修改的服务主体名称（SPN），即那些不是由系统自动生成的 SPN。这是因为基于主机的 SPN 受到随机生成的 128 字符密码的保护，并且每 30 天自动更改一次，几乎不可能通过暴力破解攻击。

另一方面，由域用户创建的 SPN 通常使用更具规律性和可预测性的人类模式密码，使其更容易受到破解技术的攻击。此外，这些密码往往很少更新，成为这类攻击的理想目标。这些账户被称为 **Kerberoastable 用户**。

### 4. 白银票据攻击（Silver Ticket Attack）

![白银票据攻击示意图](https://gh.iinx.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240905142129.png)

> Kerberos 认证流程步骤：*6. KRB_AP_REP：授予客户端对服务的访问权限*

“白银票据攻击”是通过伪造票证授权服务（TGS）或服务票据（ST）实现的攻击。攻击者可以冒充相关域内的任何用户连接到特定服务。

#### 白银票据攻击的工作原理

白银票据攻击的前提是攻击者掌握了某个服务账户的凭据。

要充分理解白银票据攻击的工作机制，需要参考之前提到的 Kerberos 认证流程。

正如我们之前提到的，在 KRB_TGS_REP 响应中，服务票据（ST）会生成并使用服务密钥（service key）加密。而该服务密钥本质上是运行该服务的账户密码的派生值。

随后，客户端通过 KRB_AP_REQ 请求将服务票据提交给代表相关服务的应用服务器。应用服务器解密该服务票据，如果解密成功且票据结构正确，则允许访问该服务。

当攻击者获得运行某个服务的用户的凭据时，可以伪造一个代表任何系统用户的服务票据。接下来，攻击者使用服务账户的 NTLM 哈希加密伪造的服务票据，并通过 KRB_AP_REQ 请求将其直接提交给应用服务器。

#### 伪造服务票据的创建

要创建一个伪造的服务票据，攻击者需要掌握以下信息：

- **SPN（服务主体名称）**：即您想要访问的特定服务的 SPN。
- **域的 SID**
- **服务账户的 NTLM 哈希**
- **服务票据用户**：即您想要用来访问服务的用户。

手动创建服务票据的过程非常复杂，Impacket 套件中的 "ticketer.py "工具可用于简化服务票单创建流程。

### 5. MS14–068（Kerberos Checksum Vulnerability，Kerberos 校验和漏洞）

![MS14–068 攻击示意图](https://gh.iinx.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240905143120.png)

#### MS14–068 简介

MS14–068，也被称为 **Kerberos 校验和漏洞**，于 2014 年 11 月被发现，对 Kerberos 认证系统构成了重大威胁。这一漏洞严重到在网络安全界引发了广泛关注。

该漏洞允许任何域用户轻松地进行权限提升。要认识到该漏洞的严重性，必须强调的是，这个漏洞使任何域用户都有能力加入他们在域内选择的任何组，包括具有管理员权限的组。

#### MS14–068 的根源

要深入了解该漏洞，我们需要回顾 Kerberos 认证流程，特别是其中的一个关键组件：**票证授权票据（TGT）**。

为了理解这个漏洞，我们需要了解 TGT 的结构。

![简化的TGT可视化表示](https://gh.iinx.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240905143323.png)

TGT 包含一个结构，称为特权属性证书（Privilege Attribute Certificate，PAC），它存储了与该 TGT 所属用户相关的信息，例如用户的 RID（Relative Identifier，相对标识符）及其所属的组。为了确保 PAC 的完整性，KDC（密钥分发中心）使用 KDC 主密钥（KDC Master Key）对其进行加密，该密钥仅 KDC 知晓。

此漏洞源于 KDC 在验证 PAC 签名时存在的缺陷。由于 PAC 签名验证中的错误，攻击者能够创建伪造的 PAC，并通过 KDC 的验证。由于 PAC 包含用户的组信息，攻击者可以利用该漏洞将自己添加到他们不属于的组中，甚至可能获得管理员权限。

漏洞的根源在于 **Microsoft 特权属性证书（MS-PAC）** 数据结构中的 **PAC_SIGNATURE_DATA** 部分。

```c
typedef struct _PAC_SIGNATURE_DATA {
    ULONG SignatureType;
    UCHAR Signature[ANYSIZE_ARRAY];
} PAC_SIGNATURE_DATA, *PPAC_SIGNATURE_DATA;
```

这个结构要求指定一个名为 **SignatureType** 的参数。根据微软的规定，该字段可以取以下三个值之一：

- **KERB_CHECKSUM_HMAC_MD5**
- **HMAC_SHA1_96_AES128**
- **HMAC_SHA1_96_AES256**

问题在于，受 MS14–068 漏洞影响的 **密钥分发中心（KDC）** 没有正确验证 **SignatureType** 字段的值是否在预期范围内。相反，KDC 接受了在低级加密库中实现的任何校验和算法。这意味着攻击者可以使用 **CRC32 校验和函数** 来伪造 PAC，而无需掌握任何密钥。

#### 漏洞的利用

下图，我们展示了一个简化的 TGS-REQ 报文可视化示意图，该报文旨在利用 MS14-068 漏洞。 在本例中，包含了一个有效的 TGT，但明显缺少预期的 PAC（Privilege Attribute Certificate，特权属性证书）信息。 相反，攻击者在 "enc-authorization-data "字段中插入了经过篡改的 PAC。 这个伪造的 PAC 谎称相关用户是各种高权限组（包括域管理员组）的成员。 此外，需要强调的是，该 PAC 是通过简单的 MD5 技术“签名”的。

![TGS-REQ 包含伪造的 PAC 来利用 MS14–068](https://gh.iinx.top/https://raw.githubusercontent.com/iselt/ImageBed/main/20240905144147.png)

## 综述

最终，我们已走到了本文的结尾。我想感谢你花时间详细探索 Kerberos 认证及相关认证流攻击的迷人世界。我理解理论有时可能会让人感到不知所措，尤其是在像渗透测试这样实践导向的领域。

然而，当我们结束这一章节时，我想提醒你，深入理解概念的美在于它能让你在现实世界中更加有效地应对各种情况。你现在已经掌握了 Kerberos 认证的基本原理以及可以实施的攻击类型。

我真诚地希望这次阅读对你有所启发，并且你对自己所获得的深刻理解感到自豪。在你继续踏上渗透测试的旅程时，请记住，知识是一个强大的工具。在未来的挑战中明智而负责任地运用它。

再次感谢你的时间和投入。直到下一次在广阔的网络安全世界中的冒险！

为你撰写这篇文章并为社区做出贡献，我感到非常荣幸。
