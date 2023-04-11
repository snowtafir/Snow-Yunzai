# TRSS-Yunzai

基于 [喵版云崽](https://gitee.com/yoimiya-kokomi/Miao-Yunzai) 改造

需要同时安装 [miao-plugin](https://github.com/yoimiya-kokomi/miao-plugin.git)，且后续的一些底层改造可能会改变数据结构，无法直接迁回原版 Yunzai，请根据自己需求情况慎重安装

---

- 支持多账号
- 支持协议端：go-cqhttp、ComWeChat
- 由于完全删除了 OICQ，并且内置 `segment`，若插件缺少 OICQ，需删除 `import { segment } from "oicq"`

## TRSS-Yunzai 后续计划

先刨坑，但也许会咕咕咕

- 完善现有协议端
- 支持更多协议端

项目仅供学习交流使用，严禁用于任何商业用途和非法行为

## 使用方法

### 建议使用 TRSS Script 一键安装管理

- [🌌 TRSS](https://TRSS.me)
- [🔼 Vercel](https://TRSS-Script.Vercel.app)
- [🐱 GitHub](https://TimeRainStarSky.GitHub.io/TRSS_Script)
- [🇬 Gitee](https://Gitee.com/TimeRainStarSky/TRSS_Script)

### 手动安装

> 环境准备： Windows or Linux，Node.js（ [版本至少 v16 以上](http://nodejs.cn/download) ）， [Redis](https://redis.io/docs/getting-started/installation)

1.克隆项目并安装 miao-plugin

请根据网络情况选择 Github 安装或 Gitee 安装

```
# 使用 Github
git clone --depth 1 https://github.com/TimeRainStarSky/Yunzai
cd Yunzai
git clone --depth 1 https://github.com/yoimiya-kokomi/miao-plugin plugins/miao-plugin

# 使用Gitee
git clone --depth 1 https://gitee.com/TimeRainStarSky/Yunzai
cd Yunzai
git clone --depth 1 https://gitee.com/yoimiya-kokomi/miao-plugin plugins/miao-plugin
```

2.安装 [pnpm](https://pnpm.io/zh/installation)，已安装的可以跳过

```
# 使用npmjs.org安装
npm install pnpm -g

# 指定国内源npmmirror.com安装
npm --registry=https://registry.npmmirror.com install pnpm -g
```

3.安装依赖

```
# 直接安装
pnpm install -P

# 如依赖安装缓慢或失败，可尝试更换国内npm源后再执行install命令
pnpm config set registry https://registry.npmmirror.com
pnpm install -P
```

4.运行

```
node app
```

5.启动协议端：

<details><summary>go-cqhttp</summary>

下载运行 [go-cqhttp](https://docs.go-cqhttp.org)，选择反向 WebSocket，修改 `config.yml`，以下为必改项：

```
uin: 账号
password: '密码'
post-format: array
universal: ws://localhost:2536/go-cqhttp
```

</details>

<details><summary>ComWeChat</summary>

下载运行 [ComWeChat](https://justundertaker.github.io/ComWeChatBotClient)，修改 `.env`，以下为必改项：

```
websocekt_type = "Backward"
websocket_url = ["ws://localhost:2536/ComWeChat"]
```

</details>

6.设置主人：发送 `#设置主人`，后台日志获取验证码并发送

## 致谢

|                           Nickname                            | Contribution         |
| :-----------------------------------------------------------: | -------------------- |
|    [Le-niao Yunzai](https://gitee.com/le-niao/Yunzai-Bot)     | 乐神的 Yunzai-Bot    |
|  [Miao-Yunzai](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)  | 喵喵的 Miao-Yunzai   |
| [GardenHamster](https://github.com/GardenHamster/GenshinPray) | 模拟抽卡背景素材来源 |
|    [西风驿站](https://bbs.mihoyo.com/ys/collection/839181)    | 角色攻略图来源       |
|  [米游社友人 A](https://bbs.mihoyo.com/ys/collection/428421)  | 角色突破素材图来源   |
