# userscripts

A ScriptCat remote subscription repo. Add the URL below in ScriptCat to install and silently update the scripts in this repository.

## Subscribe

Add this HTTPS URL in ScriptCat:

```
https://raw.githubusercontent.com/SyberRabbit/userscripts/main/subscribe.user.sub.js
```

The subscription file uses a `UserSubscribe` header and a `.user.sub.js` suffix. The first install shows a confirmation dialog; later updates are silent.

If GitHub raw is blocked, prefix the **subscription URL** yourself. Local scripts already use jsDelivr; Greasy Fork scripts keep the author's update URL.

## Scripts

| Script | Source | Description |
| --- | --- | --- |
| DeepSeek Super Toolbox | [Greasy Fork #578512](https://greasyfork.org/scripts/578512) | Follows the author |
| Zhihu layout | [Greasy Fork #21659](https://greasyfork.org/scripts/21659) | Follows the author |
| [Linux.Do prevent Esc](scripts/linux-do-prevent-esc.user.js) | this repo | linux.do page behavior |
| [Clash Connection Monitor](scripts/clash-connection-monitor.user.js) | this repo | Clash direct/proxy status |
| [HXC reverse unlock](scripts/hxc-pure-reverse.user.js) | this repo | In-page playback unlock |

Clash monitor talks to a local Clash / Mihomo external controller. Set the API URL and secret from the script menu after install (secret stays on the device, not in the repo).
