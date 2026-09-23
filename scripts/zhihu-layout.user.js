// ==UserScript==
// @name         知乎排版优化
// @namespace    https://www.zhihu.com/
// @version      1.9.1
// @description  知乎排版优化!
// @author       chenglinz <onepiece8971@163.com>
// @match        https://www.zhihu.com/follow
// @match        https://www.zhihu.com/hot
// @match        https://www.zhihu.com/question/*
// @match        https://www.zhihu.com/people/*
// @match        https://www.zhihu.com/search?*
// @match        https://www.zhihu.com
// @grant        none
// @downloadURL https://raw.githubusercontent.com/SyberRabbit/userscripts/main/scripts/zhihu-layout.user.js
// @updateURL https://raw.githubusercontent.com/SyberRabbit/userscripts/main/scripts/zhihu-layout.user.js
// ==/UserScript==

(function() {
    'use strict';
    var path = location.pathname.slice(0);
    (function (){
        if (path == '/' || path == '/follow' || path == '/hot') {
            var re = document.querySelector('.GlobalSideBar');
            re.remove();
            var inner = document.querySelector('.Topstory-mainColumn');
            inner.style.marginLeft = '150px';
            inner.style.marginRight = '150px';
        }
    })();
    (function (){
        if (path.match(/\/question\/\d+/g)) {
            var re = document.querySelector('.Question-sideColumn');
            re.remove();
            var inner = document.querySelector('.Question-mainColumn');
            inner.style.marginLeft = '155px';
        }
    })();
    (function (){
        if (path.match(/\/people\/.*/g)) {
            var right = document.querySelector('.Profile-sideColumn');
            right.style.visibility = "hidden";
            var inner = document.querySelector('.Profile-mainColumn');
            inner.style.marginLeft = '155px';
        }
    })();
    // 只应用到主页,问题页,话题页,搜索页
    if (path.match(/\/search?.*/g)) {
        var re = document.querySelector('.SearchSideBar');
            re.remove();
            var inner = document.getElementById('SearchMain');
            inner.style.marginLeft = '150px';
            inner.style.marginRight = '150px';
    }
    (function(){
        // 导航不随页面滚动固定,再次按h取消
        let header = document.getElementsByTagName('header')[0];
        window.onscroll = function() {
            header.className = "Sticky AppHeader";
            let sticky = document.querySelector('.Sticky--holder');
            if (sticky) {
                sticky.style.position = "absolute";
                sticky.style.height = 0;
            }
        };
    })();
})();