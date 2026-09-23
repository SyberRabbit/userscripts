# userscripts

ScriptCat 远程订阅仓库。把下面的订阅链接填进 ScriptCat，即可一次性安装并静默更新本仓库中的脚本。

## 订阅

在 ScriptCat 中添加订阅（必须是 `https`）：

```
https://raw.githubusercontent.com/SyberRabbit/userscripts/main/subscribe.user.sub.js
```

也可以在浏览器中直接打开该链接，由 ScriptCat 弹出订阅确认。

订阅文件使用 `UserSubscribe` 头，后缀为 `.user.sub.js`。首次安装会弹出确认；之后按 ScriptCat 的更新间隔静默同步：订阅里新增的脚本会静默安装，去掉的会删除，脚本自身仍按 `@version` 更新。

国内打不开 GitHub raw 时，给**订阅入口**自行加加速前缀即可。本仓库脚本的 `@scriptUrl` 已经写成 jsDelivr；来自 Greasy Fork 的脚本直接走作者更新地址。jsDelivr 有缓存，推送后可能要几分钟才刷新。

## 收录脚本

| 脚本 | 来源 | 说明 |
| --- | --- | --- |
| DeepSeek 超级工具箱 | [Greasy Fork #578512](https://greasyfork.org/scripts/578512) | 跟作者更新：防撤回、导出、系统提示词注入 |
| 知乎排版优化 | [Greasy Fork #21659](https://greasyfork.org/scripts/21659) | 跟作者更新：去掉侧栏，加宽主栏 |
| [Linux.Do 阻止回复弹窗 Esc 关闭](scripts/linux-do-prevent-esc.user.js) | 本仓库 | linux.do 页面行为调整 |
| [Clash Connection Monitor](scripts/clash-connection-monitor.user.js) | 本仓库 | 页面角落显示当前站点的 Clash 直连/代理状态 |
| [含羞草纯逆向解锁](scripts/hxc-pure-reverse.user.js) | 本仓库 | 含羞草站点页内播放解锁 |

本仓库脚本单独安装时，使用对应文件的 jsDelivr 地址，例如：

```
https://cdn.jsdelivr.net/gh/SyberRabbit/userscripts@main/scripts/linux-do-prevent-esc.user.js
```

Clash 监视脚本需要本机 Clash / Mihomo 开启外部控制。安装后通过脚本菜单填写 API 地址和 Secret（默认 `http://127.0.0.1:9097`，Secret 只保存在本机，不会进仓库）。

## 仓库结构

```
subscribe.user.sub.js   # ScriptCat 订阅入口
scripts/                # 本仓库维护的 .user.js
LICENSE
```

## 维护

1. 改本仓库脚本后同步提高该文件的 `@version`。
2. 增删订阅条目时，改 `subscribe.user.sub.js` 的 `@scriptUrl`，并提高订阅 `@version`。
3. 推送到 GitHub `main` 后，订阅方会在下次检查更新时拉到新内容。

订阅里的 `@connect` 会覆盖所装脚本自己的 `@connect`。当前只声明了 Clash 本地 API 需要的 `127.0.0.1` 和 `localhost`。
