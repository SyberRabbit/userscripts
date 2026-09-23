// ==UserScript==
// @name         DeepSeek 超级工具箱
// @namespace    https://github.com/super-toolbox
// @version      2.5.1.2
// @description  功能可选：防撤回、导出(MD/JSON/PNG)、系统提示词注入；增强 DeepSeek 2026-06 页面兼容
// @author       Integrated
// @match        https://chat.deepseek.com/*
// @match        https://*.deepseek.com/a/chat/s/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        unsafeWindow
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// @license      MIT
// @downloadURL https://raw.githubusercontent.com/SyberRabbit/userscripts/main/scripts/deepseek-super-toolbox.user.js
// @updateURL https://raw.githubusercontent.com/SyberRabbit/userscripts/main/scripts/deepseek-super-toolbox.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ═══════════════ DEBUG ═══════════════
    const DBG = localStorage.getItem('dss_debug') === 'true';
    const log = (m, ...a) => DBG && console.log('%c[DSS:'+m+']','color:#FFD700', ...a);
    const warn = (m, ...a) => console.warn('[DSS:'+m+']', ...a);
    const err = (m, ...a) => console.error('[DSS:'+m+']', ...a);

    // ═══════════════ RECALL LOG (auto-capture & auto-export) ═══════════════
    const RecallLog = {
        _key: 'dss_recall_log',
        _max: 200,
        _entries: [],
        _loaded: false,
        _knownStatuses: ['FINISHED', 'SENDING', 'STREAMING', 'CONTENT_FILTER', 'DELETED', 'RECALLED', 'REMOVED', 'BLOCKED', 'INCOMPLETE', ''],
        _load() {
            if (this._loaded) return;
            this._loaded = true;
            try { this._entries = JSON.parse(localStorage.getItem(this._key) || '[]'); } catch(e) { this._entries = []; }
        },
        _persist() {
            if (this._entries.length > this._max) this._entries = this._entries.slice(-this._max);
            try { localStorage.setItem(this._key, JSON.stringify(this._entries)); } catch(e) {}
        },
        _buildTxt() {
            const lines = ['═══════════════════════════════════════════',
                '⚠ 防撤回功能遇到问题，请将此文件提交给开发者以帮助排查',
                '═══════════════════════════════════════════',
                '',
                'DeepSeek Super Toolbox - 撤回/异常日志',
                '导出时间: ' + new Date().toLocaleString(),
                '脚本版本: 2.5.1',
                '共 ' + this._entries.length + ' 条记录',
                '═══════════════════════════════════════════', ''];
            this._entries.forEach((e, i) => {
                lines.push('── 记录 #' + (i+1) + ' ──');
                lines.push('时间: ' + e.ts);
                lines.push('页面: ' + (e.url || ''));
                lines.push('检测来源: ' + (e.source || 'unknown'));
                lines.push('会话ID: ' + (e.sid || ''));
                lines.push('消息ID: ' + (e.mid || ''));
                lines.push('状态值: [' + (e.status || '') + ']  (status字段原始值)');
                lines.push('状态类型: ' + typeof(e.status));
                if (e.allStatuses) lines.push('同批次所有状态: ' + JSON.stringify(e.allStatuses));
                if (e.msgKeys) lines.push('消息字段: ' + JSON.stringify(e.msgKeys));
                if (e.fragmentsCount !== undefined) lines.push('fragments数量: ' + e.fragmentsCount);
                if (e.fragmentsTypes) lines.push('fragments类型: ' + JSON.stringify(e.fragmentsTypes));
                if (e.rawSnippet) lines.push('原始数据摘要: ' + e.rawSnippet);
                if (e.error) lines.push('错误: ' + e.error);
                lines.push('');
            });
            lines.push('═══════════════════════════════════════════');
            lines.push('请将此文件提交给开发者分析');
            lines.push('═══════════════════════════════════════════');
            return lines.join('\n');
        },
        _alertShown: false,
        _showAlert() {
            if (this._alertShown || document.getElementById('dss-recall-alert')) return;
            this._alertShown = true;
            const self = this;
            const el = document.createElement('div');
            el.id = 'dss-recall-alert';
            el.style.cssText = 'position:fixed;top:50px;left:50%;transform:translateX(-50%);z-index:2147483700;background:#1e293b;color:#f1f5f9;border:2px solid #f59e0b;border-radius:12px;padding:14px 20px;display:flex;align-items:center;gap:12px;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 8px 32px rgba(0,0,0,0.4);max-width:480px';
            el.innerHTML = '<span style="font-size:20px">⚠</span>' +
                '<div style="flex:1"><div style="font-weight:600;margin-bottom:2px">防撤回遇到未知状态</div>' +
                '<div style="font-size:11px;color:#94a3b8">检测到异常消息状态，请下载日志提交给开发者分析</div></div>';
            const dlBtn = document.createElement('button');
            dlBtn.textContent = '📋 下载日志';
            dlBtn.style.cssText = 'padding:6px 14px;border:none;border-radius:6px;background:#f59e0b;color:#1e293b;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap';
            dlBtn.onclick = () => { self.downloadTxt(); el.remove(); };
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = 'padding:4px 8px;border:none;border-radius:6px;background:transparent;color:#94a3b8;cursor:pointer;font-size:14px';
            closeBtn.onclick = () => el.remove();
            el.appendChild(dlBtn);
            el.appendChild(closeBtn);
            document.body.appendChild(el);
        },
        add(entry) {
            this._load();
            entry.ts = new Date().toISOString();
            entry.url = location.href;
            this._entries.push(entry);
            this._persist();
            // Show alert if status is NOT in our known list
            if (entry.status && !this._knownStatuses.includes(entry.status)) {
                log('RecallLog', '未知状态 [' + entry.status + ']，显示提示');
                this._showAlert();
            }
        },
        getAll() { this._load(); return [...this._entries]; },
        clear() { this._entries = []; this._alertShown = false; try { localStorage.removeItem(this._key); } catch(e) {} },
        downloadTxt() {
            this._load();
            if (!this._entries.length) { toast('暂无撤回日志', 'warn'); return; }
            try {
                const blob = new Blob([this._buildTxt()], {type:'text/plain;charset=utf-8'});
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'dss-recall-log-' + new Date().toISOString().slice(0,19).replace(/[T:]/g,'-') + '.txt';
                a.click();
            } catch(e) { err('RecallLog', '导出失败', e); }
        },
        exportTxt() { this.downloadTxt(); }
    };

    // Prompt injector state (global, referenced by XHR interceptor)
    let promptEnabled = false;
    let promptText = GM_getValue('dss_prompt', '');
    let promptMenuRegistered = false;

    // ═══════════════ CONFIG ═══════════════
    const CFG_KEY = 'dss_config';
    const DEFAULTS = {
        antiRecall: true,
        exportMD: true,
        exportJSON: true,
        exportImage: false,
        promptInject: false
    };
    const CFG = (() => {
        let c = {};
        const s = GM_getValue(CFG_KEY, null);
        const raw = s ? Object.assign({}, DEFAULTS, s) : {...DEFAULTS};
        c = Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, raw[k]]));
        return {
            get(k) { return c[k]; },
            toggle(k) { c[k] = !c[k]; GM_setValue(CFG_KEY, c); return c[k]; },
            getAll() { return {...c}; },
            reset() { Object.assign(c, DEFAULTS); GM_setValue(CFG_KEY, c); }
        };
    })();

    // ═══════════════ EVENT BUS ═══════════════
    const Bus = {
        _ls: {},
        on(e, f) { (this._ls[e]=this._ls[e]||[]).push(f); return () => this.off(e,f); },
        off(e, f) { if (this._ls[e]) this._ls[e] = this._ls[e].filter(x => x!==f); },
        emit(e, d) { (this._ls[e]||[]).forEach(f => { try { f(d); } catch(ex) { err('Bus', e, ex); } }); }
    };

    const Store = {
        _d: { msgs: [], sid: null, aid: null, title: '' },
        update(p) {
            const prev = JSON.stringify({msgs:this._d.msgs, sid:this._d.sid, aid:this._d.aid});
            Object.assign(this._d, p);
            if (JSON.stringify({msgs:this._d.msgs, sid:this._d.sid, aid:this._d.aid}) !== prev) {
                Bus.emit('data', {...this._d});
            }
        },
        get() { return {...this._d}; },
        hasData() { return this._d.msgs.length > 0; }
    };

    // ═══════════════ NETWORK INTERCEPTOR ═══════════════
    const API_RE = /\/api\/v0\/chat\/(history_messages|completion|edit_message|regenerate|continue|resume_stream)/;
    const CONTENT_FILTER = 'CONTENT_FILTER';

    function findBizPayload(v, depth = 0) {
        if (!v || typeof v !== 'object' || depth > 7) return null;
        if (Array.isArray(v.chat_messages) && v.chat_messages.length > 0) return v;
        for (const item of (Array.isArray(v) ? v : Object.values(v))) {
            const found = findBizPayload(item, depth + 1);
            if (found) return found;
        }
        return null;
    }

    function handleBiz(biz) {
        biz = findBizPayload(biz) || biz;
        if (!biz?.chat_messages?.length) {
            warn('Store', 'handleBiz 跳过: msgs=' + (biz?.chat_messages?.length || 0));
            return;
        }
        const sid = biz.chat_session?.id || biz.chat_session_id || biz.session_id || getSidFromUrl() || Store.get().sid || '';
        const aid = biz.chat_session?.current_message_id || biz.current_message_id || biz.message_id || '';
        const title = biz.chat_session?.title || biz.title || document.title.replace(/\s*-\s*DeepSeek.*/i, '') || '';
        warn('Store', 'handleBiz 收到数据: msgs=' + biz.chat_messages.length + ' sid=' + sid);
        Store.update({
            msgs: biz.chat_messages,
            sid,
            aid,
            title
        });
    }

    function installXHR() {
        const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        if (w.__dss_xhr_) return; w.__dss_xhr_ = true;

        const oO = w.XMLHttpRequest.prototype.open;
        const oS = w.XMLHttpRequest.prototype.send;

        w.XMLHttpRequest.prototype.open = function(m, url, ...r) {
            this.__du = url;
            if (API_RE.test(url)) this.__dt = url.includes('history_messages') ? 'hist' : 'gen';
            return oO.apply(this, arguments);
        };
        w.XMLHttpRequest.prototype.send = function(body) {
            if (this.__dt === 'gen' && body) {
                try {
                    const p = JSON.parse(body);
                    this.__dsid = p.chat_session_id;
                    if (promptEnabled && promptText && p.prompt) {
                        p.prompt = '[系统指令]\n' + promptText + '\n[/系统指令]\n\n' + p.prompt;
                        arguments[0] = JSON.stringify(p);
                    }
                } catch(e) {}
            }
            this.addEventListener('load', function() {
                if (!this.__dt) return;
                try {
                    const json = JSON.parse(this.responseText);
                    const biz = findBizPayload(json?.data?.biz_data) || findBizPayload(json);
                    if (biz) {
                        if (this.__dt === 'hist') {
                            // Update Store FIRST so recalled handler can read fresh data
                            handleBiz(biz);
                            if (biz.chat_messages) {
                                const allStatuses = [...new Set(biz.chat_messages.map(m => m.status))];
                                for (let i = 0; i < biz.chat_messages.length; i++) {
                                    const m = biz.chat_messages[i];
                                    const s = m.status;
                                    if (s === CONTENT_FILTER || s === 'DELETED' || s === 'RECALLED' || s === 'REMOVED' || s === 'BLOCKED' || (s && s !== 'FINISHED' && s !== 'SENDING' && s !== 'STREAMING' && s !== 'INCOMPLETE')) {
                                        RecallLog.add({
                                            source: 'XHR-interceptor',
                                            sid: biz.chat_session?.id || '',
                                            mid: m.message_id || '',
                                            status: s,
                                            allStatuses: allStatuses,
                                            msgKeys: Object.keys(m),
                                            fragmentsCount: m.fragments ? m.fragments.length : 0,
                                            fragmentsTypes: m.fragments ? m.fragments.map(f => f.type) : [],
                                            rawSnippet: JSON.stringify(m).slice(0, 500)
                                        });
                                        Bus.emit('recalled', { sid: biz.chat_session.id, mid: m.message_id });
                                    }
                                }
                            }
                        } else {
                            handleBiz(biz);
                        }
                    }
                } catch(e) { err('XHR', e); }
            });
            return oS.apply(this, arguments);
        };
    }

    function installFetch() {
        const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        if (w.__dss_fetch_) return; w.__dss_fetch_ = true;
        const oF = w.fetch;
        w.fetch = async function(...args) {
            const url = typeof args[0]==='string' ? args[0] : (args[0] instanceof Request ? args[0].url : String(args[0]));
            const isT = API_RE.test(url);
            if (isT) warn('Fetch', '拦截到请求: ' + url);
            if (isT && promptEnabled && promptText) {
                try {
                    let body = null;
                    if (args[1] && typeof args[1].body === 'string') {
                        body = args[1].body;
                    } else if (args[0] instanceof Request && args[0].method !== 'GET') {
                        body = await args[0].clone().text();
                    }
                    if (body) {
                        const p = JSON.parse(body);
                        if (p.prompt) {
                            p.prompt = '[系统指令]\n' + promptText + '\n[/系统指令]\n\n' + p.prompt;
                            const newBody = JSON.stringify(p);
                            if (args[1] && typeof args[1].body === 'string') {
                                args[1] = Object.assign({}, args[1], { body: newBody });
                            } else if (args[0] instanceof Request) {
                                args[0] = new Request(args[0], { body: newBody });
                            }
                        }
                    }
                } catch(e) {}
            }
            const resp = await oF.apply(this, args);
            if (isT && resp.ok) {
                resp.clone().json().then(j => {
                    const b = findBizPayload(j?.data?.biz_data) || findBizPayload(j);
                    if (b) { warn('Fetch', '响应数据: msgs=' + (b.chat_messages?.length || 0)); handleBiz(b); }
                    else warn('Fetch', '响应无 biz_data: keys=' + Object.keys(j?.data || {}));
                }).catch(e => { warn('Fetch', 'JSON解析失败: ' + e); });
            }
            return resp;
        };
    }

    async function readIDB(targetSid) {
        const d = Store.get();
        const sid = targetSid || d.sid || getSidFromUrl();
        if (d.msgs.length > 0 || !sid || !indexedDB.databases) return;
        log('IDB', '回退读取中... sid=' + sid);
        const find = (v, depth) => {
            if (!v || typeof v !== 'object' || depth > 8) return null;
            if (v.chat_session?.id === sid && v.chat_messages?.length > 0) return v;
            for (const item of (Array.isArray(v)?v:Object.values(v))) { const r = find(item, depth+1); if (r) return r; }
            return null;
        };
        for (const { name } of await indexedDB.databases()) {
            if (!name) continue;
            try {
                const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
                for (const store of db.objectStoreNames) {
                    const recs = await new Promise(res => { const o=[], r=db.transaction(store,'readonly').objectStore(store).openCursor(); r.onsuccess=e=>{const c=e.target.result;if(!c)return res(o);o.push(c.value);c.continue();};r.onerror=()=>res(o); });
                    for (const v of recs) { const f = find(v,0); if (f) { handleBiz(f); db.close(); return; } }
                }
                db.close();
            } catch(e) {}
        }
    }

    // ═══════════════ MODULE MANAGER ═══════════════
    const MM = {
        _mods: {}, _act: {}, _cleanup: {},
        reg(name, init, stop) { this._mods[name] = {init, stop:stop||(()=>{})}; },
        start(name) {
            if (this._act[name] || !this._mods[name]) return;
            try {
                const cleanup = this._mods[name].init();
                if (typeof cleanup === 'function') this._cleanup[name] = cleanup;
                this._act[name]=true;
                log('MM','启动: '+name);
            } catch(e) { err('MM','启动失败 '+name, e); }
        },
        stop(name) {
            if (!this._act[name]) return;
            try {
                if (this._cleanup[name]) {
                    this._cleanup[name]();
                    delete this._cleanup[name];
                }
                this._mods[name].stop();
                this._act[name]=false;
                log('MM','停止: '+name);
            } catch(e) { err('MM','停止失败 '+name, e); }
        },
        toggle(name) { this._act[name] ? this.stop(name) : this.start(name); },
        initAll() { const c = CFG.getAll(); for (const [k,v] of Object.entries(c)) if (v) this.start(k); }
    };

    // ═══════════════ TOAST ═══════════════
    function toast(msg, type) {
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);padding:8px 20px;border-radius:8px;color:#fff;z-index:2147483700;font-size:13px;font-family:system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);animation:dss-fade 2.2s forwards';
        el.style.background = type==='success'?'#059669':type==='warn'?'#d97706':'#dc2626';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2400);
    }
    GM_addStyle('@keyframes dss-fade{0%{opacity:0;transform:translateX(-50%) translateY(-10px)}12%{opacity:1;transform:translateX(-50%) translateY(0)}82%{opacity:1}100%{opacity:0}}');

    // ═══════════════ UI: SETTINGS PANEL (TOP-LEFT AREA) ═══════════════
    function createSettingsPanel() {
        GM_addStyle(`
#dss-settings-btn{position:fixed;top:12px;right:16px;z-index:2147483600;width:32px;height:32px;border-radius:50%;background:rgba(100,116,139,0.6);color:#fff;border:none;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;opacity:0.5}
#dss-settings-btn:hover{opacity:1;transform:scale(1.15);background:#4D6BFE}
#dss-settings-btn.has-active{opacity:0.85;background:#059669}
.dss-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:2147483700;display:none;justify-content:center;align-items:center}
.dss-overlay.open{display:flex}
.dss-modal{background:#fff;color:#1f2937;border-radius:16px;padding:24px;width:380px;max-width:90vw;max-height:82vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:system-ui,sans-serif}
.dss-modal h3{margin:0 0 16px;font-size:17px}
.dss-row{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 0;border-bottom:1px solid #f3f4f6}
.dss-row-label{font-size:14px;font-weight:500}
.dss-row-desc{font-size:11px;color:#9ca3af;margin-top:2px}
.dss-toggle{position:relative;width:44px;height:24px;flex-shrink:0;background:#d1d5db;border-radius:12px;cursor:pointer;transition:background 0.2s;border:none;padding:0;margin-left:12px}
.dss-toggle.on{background:#4D6BFE}
.dss-toggle::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:transform 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
.dss-toggle.on::after{transform:translateX(20px)}
.dss-ftr{display:flex;gap:8px;margin-top:16px;justify-content:space-between;flex-wrap:wrap}
.dss-btn{padding:8px 14px;border-radius:8px;border:none;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.15s}
.dss-btn-p{background:#4D6BFE;color:#fff}.dss-btn-p:hover{background:#3b5be0}
.dss-btn-s{background:#f3f4f6;color:#374151}.dss-btn-s:hover{background:#e5e7eb}
.dss-btn-r{background:#ef4444;color:#fff}.dss-btn-r:hover{background:#dc2626}
@media(prefers-color-scheme:dark){.dss-modal{background:#1e293b;color:#f1f5f9}.dss-row{border-bottom-color:#334155}.dss-row-desc{color:#94a3b8}.dss-toggle{background:#475569}.dss-btn-s{background:#334155;color:#e2e8f0}.dss-btn-s:hover{background:#475569}}
        `);

        const btn = document.createElement('button');
        btn.id = 'dss-settings-btn'; btn.innerHTML = '⚙';
        document.body.appendChild(btn);

        const ov = document.createElement('div'); ov.className = 'dss-overlay';
        ov.innerHTML = '<div class="dss-modal"><h3>🛠 DeepSeek 工具箱</h3><div id="dss-switches"></div><div class="dss-ftr"><button class="dss-btn dss-btn-s" id="dss-dump">📋 导出状态</button><button class="dss-btn dss-btn-s" id="dss-debug">🐛 '+(DBG?'关闭':'开启')+'调试</button><button class="dss-btn dss-btn-r" id="dss-reset">↺ 重置全部</button><button class="dss-btn dss-btn-p" id="dss-close">关闭</button></div></div>';
        document.body.appendChild(ov);

        const mods = [
            { k:'antiRecall', l:'防撤回', d:'拦截被屏蔽/撤回的消息，自动本地缓存恢复。被恢复的内容可正常导出。' },
            { k:'exportMD', l:'导出 Markdown', d:'高质量 MD 格式，含思考链、来源引用' },
            { k:'exportJSON', l:'导出 JSON', d:'完整原始数据导出为 JSON 文件' },
            { k:'exportImage', l:'导出截图', d:'短对话直接导出；长对话可选择要生成图片的消息' },
            { k:'promptInject', l:'提示词注入', d:'注入自定义系统指令。需先在 Tampermonkey 菜单设置提示词内容。' }
        ];

        const swDiv = ov.querySelector('#dss-switches');
        mods.forEach(m => {
            const row = document.createElement('div'); row.className = 'dss-row';
            row.innerHTML = '<div><div class="dss-row-label">'+m.l+'</div><div class="dss-row-desc">'+m.d+'</div></div><button class="dss-toggle '+(CFG.get(m.k)?'on':'')+'" data-k="'+m.k+'"></button>';
            row.querySelector('.dss-toggle').addEventListener('click', function() {
                const k = this.dataset.k; const ns = CFG.toggle(k);
                this.classList.toggle('on', ns); MM.toggle(k); updateBtn();
            });
            swDiv.appendChild(row);
        });

        btn.onclick = () => ov.classList.toggle('open');
        ov.querySelector('#dss-close').onclick = () => ov.classList.remove('open');
        ov.addEventListener('click', e => { if (e.target===ov) ov.classList.remove('open'); });
        ov.querySelector('#dss-dump').onclick = () => {
            const st = { config:CFG.getAll(), modules:Object.keys(MM._act).filter(k=>MM._act[k]), store:Store.get(), ts:new Date().toISOString() };
            const b = new Blob([JSON.stringify(st,null,2)],{type:'application/json'});
            const a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download='dss-state-'+Date.now()+'.json'; a.click();
            toast('状态已导出', 'success');
        };
        ov.querySelector('#dss-debug').onclick = () => { localStorage.setItem('dss_debug', DBG?'false':'true'); location.reload(); };
        ov.querySelector('#dss-reset').onclick = () => { if (confirm('重置所有设置为默认值？')) { CFG.reset(); RecallLog.clear(); location.reload(); } };

        function updateBtn() {
            const any = Object.keys(CFG.getAll()).some(k => CFG.get(k));
            btn.classList.toggle('has-active', any);
        }
        updateBtn();
    }

    // ═══════════════ MODULE: ANTI-RECALL ═══════════════
    MM.reg('antiRecall', () => {
        const SP = 'dss_deleted_';
        const getKey = (sid, mid) => SP + sid + '_' + mid;

        // Track restored messages to avoid duplicate toasts
        const restoredSet = new Set();
        const memoryCache = new Map();

        // Check if a message has a recall-like status
        function isRecalledStatus(s) {
            return s === CONTENT_FILTER || s === 'DELETED' || s === 'RECALLED' || s === 'REMOVED' || s === 'BLOCKED';
        }

        // Check if a message has meaningful content
        function hasContent(m) {
            if (m.fragments && m.fragments.length > 0) {
                return m.fragments.some(f => f.content);
            }
            return !!m.content;
        }

        function cacheMsg(sid, msg) {
            if (!sid || !msg?.message_id || !hasContent(msg) || isRecalledStatus(msg.status)) return;
            const key = getKey(sid, msg.message_id);
            const snapshot = JSON.parse(JSON.stringify(msg));
            memoryCache.set(key, snapshot);
            try { localStorage.setItem(key, JSON.stringify(snapshot)); } catch(e) {}
        }

        function loadCached(sid, mid) {
            const key = getKey(sid, mid);
            const mem = memoryCache.get(key);
            if (mem) return mem;
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : null;
            } catch(e) {
                return null;
            }
        }

        const offRecalled = Bus.on('recalled', ({ sid, mid }) => {
            log('AntiRecall', '检测到内容被撤回: '+mid);
            // Try to save the message from Store cache before it's overwritten
            const d = Store.get();
            if (d.msgs) {
                const msg = d.msgs.find(m => m.message_id === mid);
                if (msg && hasContent(msg) && !isRecalledStatus(msg.status)) cacheMsg(sid, msg);
            }
        });

        const offData = Bus.on('data', d => {
            if (!d.msgs) return;
            let restored = 0;
            const knownStatuses = ['FINISHED', 'SENDING', 'STREAMING', 'CONTENT_FILTER', 'DELETED', 'RECALLED', 'REMOVED', 'BLOCKED', 'INCOMPLETE'];
            for (let i = 0; i < d.msgs.length; i++) {
                const m = d.msgs[i];
                // 1. Cache every usable message before DeepSeek can replace it with a recall/filter state.
                if (m.message_id && hasContent(m) && !isRecalledStatus(m.status)) {
                    cacheMsg(d.sid, m);
                }

                // 2. Restore recalled messages from cache
                if (isRecalledStatus(m.status) && m.message_id && !restoredSet.has(m.message_id)) {
                    try {
                        const cachedMsg = loadCached(d.sid, m.message_id);
                        if (cachedMsg) {
                            const frags = (cachedMsg.fragments || []).filter(f => f.content);
                            if (frags.length > 0) {
                                frags.push({id: frags.length+1, type:'TIP', style:'WARNING', content:'⚠ 此回复曾被撤回，内容来自本地缓存'});
                                d.msgs[i] = {...cachedMsg, fragments: frags, status: 'FINISHED'};
                                restoredSet.add(m.message_id);
                                restored++;
                            } else if (cachedMsg.content) {
                                d.msgs[i] = {...cachedMsg, status: 'FINISHED'};
                                restoredSet.add(m.message_id);
                                restored++;
                            }
                        }
                    } catch(e) {}
                }
                // 3. Auto-capture: log any message with an UNKNOWN status (not in our list)
                if (m.status && !knownStatuses.includes(m.status) && m.message_id) {
                    RecallLog.add({
                        source: 'antiRecall-data',
                        sid: d.sid || '',
                        mid: m.message_id || '',
                        status: m.status,
                        msgKeys: Object.keys(m),
                        fragmentsCount: m.fragments ? m.fragments.length : 0,
                        fragmentsTypes: m.fragments ? m.fragments.map(f => f.type) : [],
                        rawSnippet: JSON.stringify(m).slice(0, 500)
                    });
                    log('AntiRecall', '发现未知状态: [' + m.status + '] mid=' + m.message_id);
                }
            }
            if (restored > 0) {
                Store.update({msgs: d.msgs});
                toast('已恢复 '+restored+' 条被撤回的消息', 'warn');
            }
        });

        return () => {
            offRecalled();
            offData();
            restoredSet.clear();
            memoryCache.clear();
        };
    });

    // ═══════════════ MODULE: EXPORT BUTTONS (TOP, SLIGHTLY LEFT) ═══════════════
    // Extract session ID from URL
    function getSidFromUrl() {
        const m = location.href.match(/\/chat\/s\/([0-9a-f-]{36})/i);
        return m ? m[1] : null;
    }

    function injectExportBar() {
        if (document.getElementById('dss-export-bar')) return;

        const bar = document.createElement('div');
        bar.id = 'dss-export-bar';
        bar.style.cssText = 'position:fixed;top:12px;right:56px;z-index:2147483600;display:flex;gap:6px;align-items:center;width:auto;max-width:calc(100vw - 96px);flex-wrap:wrap;justify-content:flex-end;pointer-events:none';
        document.body.appendChild(bar);

        // JSON button
        if (CFG.get('exportJSON')) {
            const jb = document.createElement('button');
            jb.id = 'dss-btn-json';
            jb.style.cssText = 'padding:5px 12px;border:none;border-radius:6px;background:rgba(5,150,105,0.75);color:#fff;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;transition:all 0.15s;pointer-events:auto';
            jb.textContent = '📥 JSON';
            jb.onclick = () => doExport('json', jb);
            bar.appendChild(jb);
        }

        // MD button
        if (CFG.get('exportMD')) {
            const mb = document.createElement('button');
            mb.id = 'dss-btn-md';
            mb.style.cssText = 'padding:5px 12px;border:none;border-radius:6px;background:rgba(37,99,235,0.75);color:#fff;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;transition:all 0.15s;pointer-events:auto';
            mb.textContent = '📝 MD';
            mb.onclick = () => doExport('md', mb);
            bar.appendChild(mb);
        }

        // Prompt toggle button
        if (CFG.get('promptInject')) {
            setTimeout(() => createPromptToggle(bar), 100);
        }

        // Image button
        if (CFG.get('exportImage') && typeof html2canvas !== 'undefined') {
            const ib = document.createElement('button');
            ib.id = 'dss-btn-img';
            ib.style.cssText = 'padding:5px 12px;border:none;border-radius:6px;background:rgba(124,58,237,0.75);color:#fff;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;transition:all 0.15s;pointer-events:auto';
            ib.textContent = '📸 截图';
            ib.onclick = () => doImageExport(ib);
            bar.appendChild(ib);
        }
    }

    // Auto-restore export bar if DeepSeek's re-render removes it from DOM
    function watchExportBar() {
        let debounce = null;
        const observer = new MutationObserver(() => {
            if (debounce) return;
            debounce = setTimeout(() => {
                debounce = null;
                if (!document.getElementById('dss-export-bar')) {
                    if (CFG.get('exportMD') || CFG.get('exportJSON') || CFG.get('exportImage')) {
                        warn('Bar', '导出栏被移除，正在恢复...');
                        injectExportBar();
                    }
                }
            }, 500);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function extractDomExportData() {
        const root = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
        const selectors = [
            '.ds-message',
            '.ds-markdown',
            '[class*="markdown"]',
            '[class*="Markdown"]',
            '[data-message-id]',
            '[data-testid*="message"]',
            '[data-role]',
            '[class*="message"]',
            '[class*="Message"]',
            '[class*="prose"]',
            '[class*="content"]',
            '[class*="chat-message"]',
            'article'
        ];
        const seen = new Set();
        const nodes = [];
        selectors.forEach(sel => {
            root.querySelectorAll(sel).forEach(el => {
                if (seen.has(el) || !el.offsetParent) return;
                const text = (el.innerText || el.textContent || '').trim();
                if (text.length < 2) return;
                if (/^(JSON|MD|截图|已开启|已关闭|DeepSeek 工具箱|新对话|开启新对话)$/i.test(text)) return;
                if (text.includes('DeepSeek 工具箱') || text.includes('接口数据不可用，已改用页面内容导出')) return;
                seen.add(el);
                nodes.push({ el, text });
            });
        });
        if (nodes.length === 0) {
            root.querySelectorAll('p, li, pre, h1, h2, h3, blockquote').forEach(el => {
                if (seen.has(el) || !el.offsetParent) return;
                const text = (el.innerText || el.textContent || '').trim();
                if (text.length < 6) return;
                seen.add(el);
                nodes.push({ el, text });
            });
        }
        let items = nodes;
        if (items.length === 0) {
            const text = (root.innerText || '').trim();
            if (text) items = text.split(/\n{2,}/).map(t => ({ el: root, text: t.trim() })).filter(x => x.text.length > 2);
        }
        const unique = [];
        const textSeen = new Set();
        items.forEach(item => {
            const compact = item.text.replace(/\s+/g, ' ').slice(0, 500);
            if (textSeen.has(compact)) return;
            textSeen.add(compact);
            unique.push(item);
        });
        const msgs = unique.map((item, i) => {
            const cls = String(item.el?.className || '').toLowerCase();
            const role = /user|human|question|ask/.test(cls) ? 'USER' : (/assistant|bot|answer|ai|deepseek/.test(cls) ? 'ASSISTANT' : (i % 2 === 0 ? 'USER' : 'ASSISTANT'));
            return {
                message_id: 'dom-' + i,
                role,
                status: 'FINISHED',
                inserted_at: Math.floor(Date.now() / 1000),
                fragments: [{ type: 'RESPONSE', content: item.text }]
            };
        });
        return {
            sid: getSidFromUrl() || 'dom-' + Date.now(),
            aid: '',
            title: document.title.replace(/\s*-\s*DeepSeek.*/i, '') || 'DeepSeek 对话',
            msgs,
            source: 'dom'
        };
    }

    function tryDomExport(type, btn, reason) {
        const domData = extractDomExportData();
        if (domData.msgs.length > 0) {
            warn('Export', '接口数据不可用，使用 DOM 兜底导出: ' + reason + ' msgs=' + domData.msgs.length);
            toast('接口数据不可用，已改用页面内容导出', 'warn');
            execExport(type, domData, btn);
            return true;
        }
        return false;
    }

    function doExport(type, btn) {
        const _dbg = Store.get();
        warn('Export', '点击导出: type=' + type + ' hasData=' + Store.hasData() + ' msgs=' + _dbg.msgs.length + ' sid=' + _dbg.sid);
        if (!Store.hasData()) {
            btn.textContent = '⏳ 等待中...';
            btn.style.background = 'rgba(217,119,6,0.85)';
            // Auto-retry: wait for next data event, with timeout safety
            let h = null;
            let timer = null;
            let resolved = false;
            const resolve = (d) => {
                if (resolved) return;
                resolved = true;
                if (h) Bus.off('data', h);
                if (timer) clearTimeout(timer);
                execExport(type, d, btn);
            };
            h = Bus.on('data', d => {
                if (d.msgs.length > 0) resolve(d);
            });
            // Check immediately (data might have arrived between click and listener setup)
            const d = Store.get();
            if (d.msgs.length > 0) { resolve(d); return; }
            // Retry after a short delay (handles SPA route transitions)
            timer = setTimeout(() => {
                const d2 = Store.get();
                if (d2.msgs.length > 0) { resolve(d2); return; }
                // Final fallback: try URL → Store → IndexedDB → direct API fetch
                const sid = getSidFromUrl() || Store.get().sid;
                if (!sid) {
                    if (tryDomExport(type, btn, 'no-session')) { resolved = true; if (h) Bus.off('data', h); return; }
                    btn.textContent = '❌ 无会话'; btn.style.background = 'rgba(220,38,38,0.85)'; toast('未找到当前会话，请打开一个对话后重试', 'error');
                    resolved = true; if (h) Bus.off('data', h); return;
                }
                // Try fetching directly from API
                const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
                try {
                    const xhr = new w.XMLHttpRequest();
                    xhr.open('GET', '/api/v0/chat/history_messages?chat_session_id=' + sid, true);
                    xhr.onload = function() {
                        try {
                            const json = JSON.parse(this.responseText);
                            const biz = findBizPayload(json?.data?.biz_data) || findBizPayload(json);
                            if (biz) handleBiz(biz);
                            const d3 = Store.get();
                            if (d3.msgs.length > 0) { resolve(d3); return; }
                        } catch(e) {}
                        // API didn't help, try IndexedDB
                        readIDB().then(() => {
                            const d4 = Store.get();
                            if (d4.msgs.length > 0) resolve(d4);
                            else {
                                if (tryDomExport(type, btn, 'api-and-idb-empty')) { resolved = true; if (h) Bus.off('data', h); return; }
                                btn.textContent = '❌ 无数据'; btn.style.background = 'rgba(220,38,38,0.85)'; toast('未能获取对话数据，请刷新页面后重试', 'error'); resolved = true; if (h) Bus.off('data', h);
                            }
                        }).catch(() => {
                            if (tryDomExport(type, btn, 'idb-error')) { resolved = true; if (h) Bus.off('data', h); return; }
                            btn.textContent = '❌ 无数据'; btn.style.background = 'rgba(220,38,38,0.85)'; toast('未能获取对话数据，请刷新页面后重试', 'error'); resolved = true; if (h) Bus.off('data', h);
                        });
                    };
                    xhr.onerror = function() {
                        // Network failed, try IndexedDB as last resort
                        readIDB().then(() => {
                            const d5 = Store.get();
                            if (d5.msgs.length > 0) resolve(d5);
                            else {
                                if (tryDomExport(type, btn, 'network-and-idb-empty')) { resolved = true; if (h) Bus.off('data', h); return; }
                                btn.textContent = '❌ 失败'; btn.style.background = 'rgba(220,38,38,0.85)'; toast('网络请求失败，请刷新页面后重试', 'error'); resolved = true; if (h) Bus.off('data', h);
                            }
                        }).catch(() => {
                            if (tryDomExport(type, btn, 'network-idb-error')) { resolved = true; if (h) Bus.off('data', h); return; }
                            btn.textContent = '❌ 失败'; btn.style.background = 'rgba(220,38,38,0.85)'; toast('网络请求失败，请刷新页面后重试', 'error'); resolved = true; if (h) Bus.off('data', h);
                        });
                    };
                    xhr.send();
                } catch(e) {
                    if (tryDomExport(type, btn, 'api-exception')) { resolved = true; if (h) Bus.off('data', h); return; }
                    btn.textContent = '❌ 失败'; btn.style.background = 'rgba(220,38,38,0.85)'; toast('导出失败，请刷新页面后重试', 'error');
                    resolved = true; if (h) Bus.off('data', h);
                }
            }, 3000);
            return;
        }
        execExport(type, Store.get(), btn);
    }

    function execExport(type, data, btn) {
        if (type === 'json') {
            const blob = new Blob([JSON.stringify({chat_session:{id:data.sid,title:data.title},chat_messages:data.msgs},null,2)],{type:'application/json'});
            const a = document.createElement('a');
            a.href=URL.createObjectURL(blob);
            a.download = ((data.title||'DeepSeek').replace(/[/\\?%*:|"<>]/g,'-')+'_'+new Date().toISOString().slice(0,10)+'.json');
            a.click();
            btn.textContent = '✅ 已导出'; btn.style.background = 'rgba(5,150,105,0.9)';
        } else {
            let md = '# '+(data.title||'DeepSeek 对话')+'\n\n';
            data.msgs.forEach(msg => {
                const role = (msg.role || '').toUpperCase() === 'USER' ? '👤 用户' : '🤖 DeepSeek';
                const time = msg.inserted_at ? new Date(msg.inserted_at*1000).toLocaleString() : '';
                md += '### '+role+'\n';
                if (time) md += '*'+time+'*\n\n';
                const frags = msg.fragments || [];
                let contentAdded = false;
                frags.forEach(f => {
                    if (f.type==='THINK') { md += '> 💭 思考过程:\n> '+(f.content||'').replace(/\n/g,'\n> ')+'\n\n'; contentAdded = true; }
                    if (f.type==='RESPONSE' && f.content) { md += f.content+'\n\n'; contentAdded = true; }
                });
                if (!contentAdded && msg.content) md += msg.content+'\n\n';
                md += '---\n\n';
            });
            const blob = new Blob([md],{type:'text/markdown'});
            const a = document.createElement('a');
            a.href=URL.createObjectURL(blob);
            a.download = ((data.title||'DeepSeek').replace(/[/\\?%*:|"<>]/g,'-')+'_'+new Date().toISOString().slice(0,10)+'.md');
            a.click();
            btn.textContent = '✅ 已导出'; btn.style.background = 'rgba(37,99,235,0.9)';
        }
        setTimeout(() => {
            if (type === 'json') { btn.textContent = '📥 JSON'; btn.style.background = 'rgba(5,150,105,0.75)'; }
            else { btn.textContent = '📝 MD'; btn.style.background = 'rgba(37,99,235,0.75)'; }
        }, 2500);
    }

    function getImageMessageNodes() {
        const root = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
        const selectors = [
            '.ds-message',
            '[data-message-id]',
            '[data-testid*="message"]',
            '[class*="message"]',
            '[class*="Message"]',
            'article'
        ];
        const clean = nodes => {
            const seen = new Set();
            return [...nodes].filter(el => {
                if (seen.has(el) || el.id?.startsWith('dss-')) return false;
                const text = (el.innerText || el.textContent || '').trim();
                const rect = el.getBoundingClientRect();
                if (text.length < 2 || rect.width < 80 || rect.height < 12) return false;
                if (text.includes('DeepSeek 工具箱') || /^(JSON|MD|截图|已开启|已关闭)$/i.test(text)) return false;
                seen.add(el);
                return true;
            });
        };
        for (const selector of selectors) {
            const nodes = clean(root.querySelectorAll(selector));
            if (nodes.length) return nodes;
        }
        return clean(root.querySelectorAll('.ds-markdown, [class*="markdown"], [class*="Markdown"], [class*="prose"]'));
    }

    function showImageSelectDialog(nodes) {
        return new Promise(resolve => {
            const ov = document.createElement('div');
            ov.id = 'dss-img-select';
            ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2147483700;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;color:#1f2937';
            const card = document.createElement('div');
            card.style.cssText = 'width:min(760px,92vw);max-height:82vh;background:#fff;border-radius:12px;box-shadow:0 24px 70px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden';
            const head = document.createElement('div');
            head.style.cssText = 'padding:16px 18px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;gap:12px';
            head.innerHTML = '<div><div style="font-weight:700;font-size:16px">选择要导出为图片的消息</div><div id="dss-img-count" style="font-size:12px;color:#64748b;margin-top:3px"></div></div>';
            const list = document.createElement('div');
            list.style.cssText = 'overflow:auto;padding:8px 14px;display:flex;flex-direction:column;gap:8px';
            const defaultStart = nodes.length > 12 ? Math.max(0, nodes.length - 10) : 0;
            nodes.forEach((node, i) => {
                const row = document.createElement('label');
                row.style.cssText = 'display:grid;grid-template-columns:22px 42px 1fr;gap:8px;align-items:start;padding:10px;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer';
                const text = (node.innerText || node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 180);
                row.innerHTML = '<input type="checkbox" data-i="'+i+'" '+(i >= defaultStart ? 'checked' : '')+'><span style="font-size:12px;color:#64748b">#'+(i+1)+'</span><span style="font-size:13px;line-height:1.45">'+text+'</span>';
                list.appendChild(row);
            });
            const foot = document.createElement('div');
            foot.style.cssText = 'padding:12px 18px;border-top:1px solid #e5e7eb;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap';
            const mk = (txt, bg, color) => {
                const b = document.createElement('button');
                b.textContent = txt;
                b.style.cssText = 'padding:8px 12px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;background:'+bg+';color:'+color;
                return b;
            };
            const all = mk('全选', '#f1f5f9', '#334155');
            const none = mk('清空', '#f1f5f9', '#334155');
            const recent = mk('最近10条', '#f1f5f9', '#334155');
            const cancel = mk('取消', '#fee2e2', '#991b1b');
            const ok = mk('生成图片', '#4D6BFE', '#fff');
            [all, none, recent, cancel, ok].forEach(b => foot.appendChild(b));
            card.appendChild(head); card.appendChild(list); card.appendChild(foot); ov.appendChild(card); document.body.appendChild(ov);
            const boxes = () => [...ov.querySelectorAll('input[type="checkbox"]')];
            const update = () => { ov.querySelector('#dss-img-count').textContent = '已选 '+boxes().filter(b=>b.checked).length+' / '+nodes.length+' 条'; };
            all.onclick = () => { boxes().forEach(b => b.checked = true); update(); };
            none.onclick = () => { boxes().forEach(b => b.checked = false); update(); };
            recent.onclick = () => { boxes().forEach((b, i) => b.checked = i >= Math.max(0, nodes.length - 10)); update(); };
            cancel.onclick = () => { ov.remove(); resolve(null); };
            ok.onclick = () => {
                const picked = boxes().filter(b => b.checked).map(b => nodes[Number(b.dataset.i)]);
                ov.remove();
                resolve(picked);
            };
            ov.addEventListener('change', update);
            update();
        });
    }

    async function doImageExport(btn) {
        let msgs = getImageMessageNodes();
        if (!msgs.length) { toast('未找到对话内容', 'error'); return; }
        const totalText = msgs.reduce((n, el) => n + ((el.innerText || el.textContent || '').length), 0);
        if (msgs.length > 12 || totalText > 12000) {
            const picked = await showImageSelectDialog(msgs);
            if (!picked) return;
            if (!picked.length) { toast('请至少选择一条消息', 'warn'); return; }
            msgs = picked;
        }

        btn.textContent = '⏳ 生成中...';
        btn.style.background = 'rgba(217,119,6,0.85)';

        const progress = document.createElement('div');
        progress.id = 'dss-img-progress';
        progress.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:2147483700;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:system-ui,sans-serif;font-size:16px';
        progress.innerHTML = '<div style="background:rgba(255,255,255,0.2);width:220px;height:4px;border-radius:2px;margin-top:16px;overflow:hidden"><div id="dss-prog-bar" style="height:100%;background:#7c3aed;width:18%;transition:width 0.25s"></div></div><div style="margin-top:12px">正在生成截图...</div>';
        document.body.appendChild(progress);

        const container = document.createElement('div');
        container.style.cssText = 'width:760px;max-width:760px;padding:20px;background:#fff;position:fixed;left:-10000px;top:0;color:#111827;font-family:system-ui,sans-serif';
        msgs.forEach(m => {
            const clone = m.cloneNode(true);
            clone.style.setProperty('max-width', '100%', 'important');
            clone.style.setProperty('width', '100%', 'important');
            clone.style.setProperty('box-sizing', 'border-box', 'important');
            container.appendChild(clone);
        });
        document.body.appendChild(container);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const bar = document.getElementById('dss-prog-bar'); if (bar) bar.style.width = '55%';

        try {
            const scale = msgs.length > 16 || totalText > 16000 ? 1 : 1.35;
            const canvas = await html2canvas(container, {scale,backgroundColor:'#ffffff',useCORS:true,logging:false,removeContainer:false});
            const b = document.getElementById('dss-prog-bar'); if (b) b.style.width = '90%';
            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            const a = document.createElement('a');
            const url = URL.createObjectURL(blob);
            a.download = 'deepseek-'+new Date().toISOString().slice(0,10)+'.png';
            a.href = url;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            btn.textContent = '✅ 已导出'; btn.style.background = 'rgba(124,58,237,0.9)';
        } catch(e) {
            err('Image', e);
            btn.textContent = '❌ 失败'; btn.style.background = 'rgba(220,38,38,0.85)';
            toast('截图失败: '+e.message, 'error');
        } finally {
            document.getElementById('dss-img-progress')?.remove();
            container.remove();
        }
        setTimeout(() => { btn.textContent = '📸 截图'; btn.style.background = 'rgba(124,58,237,0.75)'; }, 2500);
    }

    MM.reg('exportJSON', () => { setTimeout(injectExportBar, 1000); }, () => {
        document.getElementById('dss-btn-json')?.remove();
        if (!CFG.get('exportMD') && !CFG.get('exportImage')) document.getElementById('dss-export-bar')?.remove();
    });
    MM.reg('exportMD', () => { setTimeout(injectExportBar, 1000); }, () => {
        document.getElementById('dss-btn-md')?.remove();
        if (!CFG.get('exportJSON') && !CFG.get('exportImage')) document.getElementById('dss-export-bar')?.remove();
    });
    MM.reg('exportImage', () => { setTimeout(injectExportBar, 1500); }, () => {
        document.getElementById('dss-btn-img')?.remove();
        if (!CFG.get('exportJSON') && !CFG.get('exportMD')) document.getElementById('dss-export-bar')?.remove();
    });

    // ═══════════════ MODULE: PROMPT INJECTOR (TOP TOGGLE BUTTON) ═══════════════
    function createPromptToggle(bar) {
        if (document.getElementById('dss-btn-prompt')) return;
        const pb = document.createElement('button');
        pb.id = 'dss-btn-prompt';
        pb.style.cssText = 'padding:5px 12px;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;transition:all 0.15s;pointer-events:auto';
        pb.onclick = () => {
            if (!promptText) {
                toast('请先在 Tampermonkey 菜单中设置提示词内容', 'warn');
                return;
            }
            promptEnabled = !promptEnabled;
            updatePromptBtn(pb);
        };
        updatePromptBtn(pb);
        bar.appendChild(pb);
    }

    function updatePromptBtn(btn) {
        if (!btn) btn = document.getElementById('dss-btn-prompt');
        if (!btn) return;
        if (!promptText) {
            btn.textContent = '🤖 未设置';
            btn.style.background = 'rgba(156,163,175,0.75)';
        } else if (promptEnabled) {
            btn.textContent = '🤖 已开启';
            btn.style.background = 'rgba(5,150,105,0.85)';
        } else {
            btn.textContent = '🤖 已关闭';
            btn.style.background = 'rgba(107,114,128,0.75)';
        }
    }

    MM.reg('promptInject', () => {
        promptText = GM_getValue('dss_prompt', '');
        promptEnabled = false;

        // Ensure button exists (self-sufficient, doesn't depend on export bar)
        function ensureBtn() {
            let bar = document.getElementById('dss-export-bar');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'dss-export-bar';
                bar.style.cssText = 'position:fixed;top:12px;right:56px;z-index:2147483600;display:flex;gap:6px;align-items:center;width:auto;max-width:calc(100vw - 96px);flex-wrap:wrap;justify-content:flex-end;pointer-events:none';
                document.body.appendChild(bar);
            }
            createPromptToggle(bar);
        }
        setTimeout(ensureBtn, 1200);

        if (!promptMenuRegistered) {
            promptMenuRegistered = true;
        GM_registerMenuCommand('⚙ 设置系统提示词', () => {
            const p = window.prompt('输入系统提示词（将注入到每次对话中）：\n\nDeepSeek 不会显示这段文字，但会在回答时遵循这些指令。', promptText);
            if (p !== null) {
                promptText = p.trim();
                GM_setValue('dss_prompt', promptText);
                promptEnabled = !!promptText;
                updatePromptBtn();
                toast(promptText ? '提示词已设置并开启' : '提示词已清除', 'success');
            }
        });
        GM_registerMenuCommand('👁 查看/编辑提示词', () => {
            const ov = document.createElement('div');
            ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:2147483700;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
            ov.innerHTML = '<div style="background:#fff;color:#1f2937;border-radius:16px;padding:24px;width:560px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3)">'+
                '<h3 style="margin:0 0 12px;font-size:17px">'+(promptText?'当前系统提示词':'未设置提示词')+'</h3>'+
                '<textarea id="dss-prompt-view" style="flex:1;min-height:200px;padding:12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:monospace;resize:vertical;line-height:1.6;color:#1f2937;background:#f9fafb" placeholder="在此粘贴或输入提示词...">'+promptText+'</textarea>'+
                '<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">'+
                '<button id="dss-prompt-copy" style="padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:600;background:#f3f4f6;color:#374151">📋 复制</button>'+
                '<button id="dss-prompt-save" style="padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:600;background:#4D6BFE;color:#fff">💾 保存</button>'+
                '<button id="dss-prompt-close" style="padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:600;background:#f3f4f6;color:#374151">关闭</button>'+
                '</div></div>';
            document.body.appendChild(ov);
            const ta = ov.querySelector('#dss-prompt-view');
            ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
            ov.querySelector('#dss-prompt-copy').onclick = () => {
                navigator.clipboard.writeText(ta.value).then(()=>toast('已复制','success'),()=>toast('复制失败','error'));
            };
            ov.querySelector('#dss-prompt-save').onclick = () => {
                promptText = ta.value.trim(); GM_setValue('dss_prompt', promptText);
                promptEnabled = !!promptText; updatePromptBtn();
                toast(promptText?'提示词已保存并开启':'提示词已清除','success'); ov.remove();
            };
            ov.querySelector('#dss-prompt-close').onclick = () => ov.remove();
            ov.addEventListener('click', e => { if (e.target===ov) ov.remove(); });
            if (matchMedia('(prefers-color-scheme:dark)').matches) {
                const card = ov.querySelector('div');
                card.style.background='#1e293b'; card.style.color='#f1f5f9';
                ta.style.background='#0f172a'; ta.style.color='#e2e8f0'; ta.style.borderColor='#475569';
                ov.querySelector('#dss-prompt-copy').style.background='#334155'; ov.querySelector('#dss-prompt-copy').style.color='#e2e8f0';
                ov.querySelector('#dss-prompt-close').style.background='#334155'; ov.querySelector('#dss-prompt-close').style.color='#e2e8f0';
            }
        });
        }

        promptEnabled = false;
    }, () => {
        promptEnabled = false;
        document.getElementById('dss-btn-prompt')?.remove();
    });

    // ═══════════════ RECALL LOG: menu command ═══════════════
    GM_registerMenuCommand('📋 导出撤回日志', () => RecallLog.exportTxt());
    GM_registerMenuCommand('🗑 清除撤回日志', () => { RecallLog.clear(); toast('撤回日志已清除', 'success'); });

    // ═══════════════ INIT ═══════════════
    function init() {
        log('Core', 'DeepSeek Super Toolbox v2.4.0');
        installXHR();
        installFetch();
        createSettingsPanel();
        MM.initAll();
        watchExportBar();

        const SID_RE = /\/chat\/s\/([0-9a-f-]{36})/i;
        let lastSid = (location.href.match(SID_RE)||[])[1]||'';
        const checkRoute = () => {
            const sid = (location.href.match(SID_RE)||[])[1]||'';
            if (sid !== lastSid) {
                lastSid = sid;
                Store.update({msgs:[], sid, aid:null, title:''});
                setTimeout(readIDB, 1000);
            }
        };
        window.addEventListener('popstate', checkRoute);
        const _ps = history.pushState;
        history.pushState = function(){const r=_ps.apply(this,arguments);checkRoute();return r;};
        setTimeout(readIDB, 2500);

        const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        w.__DSS__ = {
            v: '2.5.1',
            status: () => { console.table(Object.keys(CFG.getAll()).map(k=>({模块:k,启用:CFG.get(k),运行中:!!MM._act[k]}))); },
            exportDebug: () => {
                const dom = extractDomExportData();
                const r = {
                    storeHasData: Store.hasData(),
                    store: Store.get(),
                    domMessageCount: dom.msgs.length,
                    domSample: dom.msgs.slice(0, 3).map(m => ({
                        role: m.role,
                        text: (m.fragments?.[0]?.content || '').slice(0, 160)
                    })),
                    sidFromUrl: getSidFromUrl(),
                    url: location.href
                };
                console.log(r);
                return r;
            },
            data: () => console.log(Store.get()),
            dump: () => {
                const s = {config:CFG.getAll(),modules:Object.keys(MM._act).filter(k=>MM._act[k]),store:Store.get()};
                const b = new Blob([JSON.stringify(s,null,2)],{type:'application/json'});
                const a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download='dss-dump-'+Date.now()+'.json'; a.click(); return s;
            },
            toggle: (k) => { CFG.toggle(k); MM.toggle(k); }
        };

        if (DBG) {
            window.addEventListener('unhandledrejection', e => err('Global','Unhandled:',e.reason));
        }

        log('Core', '就绪。控制台 __DSS__.status() 查看状态');
    }

    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
    else init();
})();
