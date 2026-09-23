# userscripts

A ScriptCat remote subscription repo. Add the URL below in ScriptCat to install and silently update the scripts in this repository.

## Subscribe

Add this HTTPS URL in ScriptCat:

```
https://raw.githubusercontent.com/SyberRabbit/userscripts/main/subscribe.user.sub.js
```

The subscription file uses a `UserSubscribe` header and a `.user.sub.js` suffix. The first install shows a confirmation dialog; later updates are silent.

## Scripts

| Script | Description |
| --- | --- |
| [DeepSeek Super Toolbox](scripts/deepseek-super-toolbox.user.js) | Anti-recall, export, system prompt injection |
| [Zhihu layout](scripts/zhihu-layout.user.js) | Hide sidebars, widen the main column |
| [Linux.Do prevent Esc](scripts/linux-do-prevent-esc.user.js) | linux.do page behavior |
| [Clash Connection Monitor](scripts/clash-connection-monitor.user.js) | Show Clash direct/proxy status for the current site |
| [HXC reverse unlock](scripts/hxc-pure-reverse.user.js) | In-page playback unlock for HXC sites |

Clash monitor talks to a local Clash / Mihomo external controller. Set the API URL and secret from the script menu after install (secret stays on the device, not in the repo).
