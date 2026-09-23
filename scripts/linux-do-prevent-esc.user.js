// ==UserScript==
// @name         Linux.Do 阻止回复弹窗 Esc 关闭
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  当在 Discourse 论坛回复框打字时，按 Esc 不会关闭弹窗
// @author       Sola
// @match        https://linux.do/*
// @grant        none
// @downloadURL  https://cdn.jsdelivr.net/gh/SyberRabbit/userscripts@main/scripts/linux-do-prevent-esc.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/SyberRabbit/userscripts@main/scripts/linux-do-prevent-esc.user.js
// ==/UserScript==

(function() {
    'use strict';

    // 动态调整页面 Title
    const NEW_TITLE = "语法在线速查";

    function setPageTitle() {
        if (document.title !== NEW_TITLE) {
            document.title = NEW_TITLE;
        }
    }

    // 1. 初始尝试设置
    setPageTitle();

    // 2. 监听 <title> 节点的变化（防止前端框架如 React/Vue/Angular 在渲染后重写 title）
    const observer = new MutationObserver(() => {
        setPageTitle();
    });

    // 待 document.head 加载完毕后开始监听
    const initObserver = () => {
        const titleEl = document.querySelector('title');
        if (titleEl) {
            observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
        } else {
            // 如果 head/title 还没出来，继续等待
            setTimeout(initObserver, 50);
        }
    };

    initObserver();
})();