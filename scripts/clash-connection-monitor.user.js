// ==UserScript==
// @name         Clash Connection Monitor
// @license      MIT
// @namespace    https://github.com/SyberRabbit/userscripts
// @version      0.2.1
// @description  在页面角落显示当前站点的 Clash 连接状态（直连/代理、规则、上下行）
// @author       Sola
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-body
// @icon         https://cdn.jsdelivr.net/gh/Dreamacro/clash/docs/logo.png
// @downloadURL  https://raw.githubusercontent.com/SyberRabbit/userscripts/main/scripts/clash-connection-monitor.user.js
// @updateURL    https://raw.githubusercontent.com/SyberRabbit/userscripts/main/scripts/clash-connection-monitor.user.js
// ==/UserScript==

(function () {
  "use strict";

  const DEFAULT_BASE_URL = "http://127.0.0.1:9097";

  function getConfig() {
    return {
      BASE_URL: GM_getValue("clash_api_base", DEFAULT_BASE_URL),
      SECRET: GM_getValue("clash_api_secret", ""),
    };
  }

  GM_registerMenuCommand("设置 Clash API 地址", () => {
    const current = GM_getValue("clash_api_base", DEFAULT_BASE_URL);
    const next = prompt("Clash / Mihomo 外部控制地址（例如 http://127.0.0.1:9097）", current);
    if (next && next.trim()) {
      GM_setValue("clash_api_base", next.trim().replace(/\/+$/, ""));
    }
  });

  GM_registerMenuCommand("设置 Clash API Secret", () => {
    const current = GM_getValue("clash_api_secret", "");
    const next = prompt("外部控制 Secret（不会写入仓库，仅保存在本机）", current);
    if (next !== null) {
      GM_setValue("clash_api_secret", next.trim());
    }
  });

  const style = document.createElement("style");
  style.textContent = `
    #clash-monitor {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 4px;
      border-radius: 12px;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      transition: all 0.2s ease;
      background: none;
      border: none;
      color: #333;
    }

    #connection-indicator {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      width: 100%;
      overflow: visible;
    }

    #connection-text {
      margin-right: 3px;
      color: black;
      text-shadow:
        1px 1px 2px white,
        -1px -1px 2px white,
        1px -1px 2px white,
        -1px 1px 2px white;
    }

    #status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
      flex-shrink: 0;
      cursor: pointer;
    }

    #connection-details {
      position: absolute;
      right: 0;
      bottom: calc(100% + 10px);
      max-height: 0;
      opacity: 0;
      overflow: hidden;
      transition: all 0.2s ease;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      padding: 0;
      font-size: 12px;
      color: #666;
      white-space: nowrap;
      pointer-events: none;
      backdrop-filter: blur(8px);
    }

    #status-dot:hover + #connection-details,
    #connection-text:hover ~ #connection-details,
    #connection-details:hover {
      max-height: 500px;
      opacity: 1;
      padding: 10px 16px;
      pointer-events: auto;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin: 4px 0;
    }

    @media (prefers-color-scheme: dark) {
      #clash-monitor {
        color: #f0f0f0;
      }
      #connection-details {
        background: rgba(40, 40, 40, 0.95);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        color: #ddd;
      }
    }
  `;

  document.head.appendChild(style);

  const monitor = document.createElement("div");
  monitor.id = "clash-monitor";
  monitor.innerHTML = `
    <div id="connection-indicator">
      <span id="connection-text">等待连接...</span>
      <div id="status-dot"></div>
      <div id="connection-details">
        <div class="detail-item">
          <span>代理链路:</span>
          <span id="proxy-chain">-</span>
        </div>
        <div class="detail-item">
          <span>规则:</span>
          <span id="rule-match">-</span>
        </div>
        <div class="detail-item">
          <span>上传:</span>
          <span id="upload-speed">-</span>
        </div>
        <div class="detail-item">
          <span>下载:</span>
          <span id="download-speed">-</span>
        </div>
      </div>
    </div>
  `;

  function mountMonitor() {
    if (!document.body) {
      setTimeout(mountMonitor, 100);
      return;
    }
    if (!document.getElementById("clash-monitor")) {
      document.body.appendChild(monitor);
    }
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function updateConnectionInfo() {
    const currentHost = window.location.hostname;
    const cfg = getConfig();
    const headers = {};
    if (cfg.SECRET) {
      headers.Authorization = `Bearer ${cfg.SECRET}`;
    }

    GM_xmlhttpRequest({
      method: "GET",
      url: `${cfg.BASE_URL}/connections`,
      headers,
      onload: function (response) {
        try {
          const data = JSON.parse(response.responseText);
          const connections = data.connections || [];

          const currentConn = connections.find((conn) => {
            const host = conn?.metadata?.host || "";
            return (
              host === currentHost ||
              host.endsWith("." + currentHost) ||
              currentHost.endsWith("." + host) ||
              host.includes(currentHost) ||
              currentHost.includes(host)
            );
          });

          const statusDot = document.getElementById("status-dot");
          const connText = document.getElementById("connection-text");
          const proxyChain = document.getElementById("proxy-chain");
          const ruleMatch = document.getElementById("rule-match");
          const uploadSpeed = document.getElementById("upload-speed");
          const downloadSpeed = document.getElementById("download-speed");

          if (!statusDot || !connText || !proxyChain || !ruleMatch || !uploadSpeed || !downloadSpeed) {
            return;
          }

          if (currentConn) {
            const chains = currentConn.chains || [];
            if (chains.includes("DIRECT")) {
              connText.textContent = "直连";
              statusDot.style.backgroundColor = "#D70026";
            } else {
              connText.textContent = "代理";
              statusDot.style.backgroundColor = "#00BFFF";
            }

            proxyChain.textContent = chains.join(" → ");
            ruleMatch.textContent = currentConn.rule || "-";
            uploadSpeed.textContent = formatBytes(currentConn.upload || 0);
            downloadSpeed.textContent = formatBytes(currentConn.download || 0);
          } else {
            connText.textContent = "无连接";
            statusDot.style.backgroundColor = "#95a5a6";
            proxyChain.textContent = "-";
            ruleMatch.textContent = "-";
            uploadSpeed.textContent = "-";
            downloadSpeed.textContent = "-";
          }
        } catch (error) {
          console.error("解析连接信息失败:", error);
        }
      },
      onerror: function (error) {
        console.error("连接 Clash API 失败:", error);
      },
    });
  }

  mountMonitor();
  updateConnectionInfo();
  setInterval(updateConnectionInfo, 5000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateConnectionInfo();
    }
  });
})();
