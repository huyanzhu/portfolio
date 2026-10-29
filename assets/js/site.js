/* =============================================================================
   site.js — 交互增强层（无框架 / 无依赖）
   原则：
     1. 数据缺失或出错时不白屏 —— 任何渲染失败都降级为 HTML 里的静态默认内容；
     2. 所有节点用 DOM API 创建（不用 innerHTML 拼接内容数据），避免注入；
     3. 动效只用 transform / opacity，并受 prefers-reduced-motion 约束（见 site.css）。
   ============================================================================= */

(function () {
  "use strict";

  var DATA = window.SITE_CONTENT || {};
  var SITE = DATA.site || {};
  var LABELS = SITE.labels || {};
  var PROFILE = DATA.profile || {};
  var PROJECTS = Array.isArray(DATA.projects) ? DATA.projects : [];
  var WRITING = Array.isArray(DATA.writing) ? DATA.writing : [];

  /* 对外的作品视图：hidden: true 的项目在首页、列表、详情、上下篇中一律不出现 */
  function visibleProjects() {
    return PROJECTS.filter(function (project) {
      return project && project.hidden !== true;
    });
  }

  /* ------------------------------------------------------------ helpers -- */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function get(path) {
    if (!path) return undefined;
    var parts = String(path).split(".");
    var node = DATA;
    for (var i = 0; i < parts.length; i += 1) {
      if (node === null || typeof node !== "object") return undefined;
      node = node[parts[i]];
    }
    return node;
  }

  function label(key, fallback) {
    var v = LABELS[key];
    return typeof v === "string" && v ? v : fallback || "";
  }

  function el(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined && content !== null) node.textContent = String(content);
    return node;
  }

  function icon(name) {
    var paths = {
      arrow:
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
      external:
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/></svg>',
      copy:
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/></svg>',
      check:
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 13l4 4L19 7"/></svg>',
      compass:
        '<svg class="empty__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>'
    };
    var tpl = document.createElement("template");
    tpl.innerHTML = paths[name] || "";
    return tpl.content.firstElementChild || el("span");
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function safe(fn) {
    return function () {
      try {
        return fn.apply(null, arguments);
      } catch (err) {
        /* 渲染失败时保留 HTML 静态骨架；把原因留在控制台便于自查 */
        if (window.console && console.warn) console.warn("[portfolio] 渲染降级：", err);
        return undefined;
      }
    };
  }

  /* ------------------------------------------------------ 文本数据绑定 -- */
  var bindTexts = safe(function () {
    $$("[data-bind]").forEach(function (node) {
      var value = get(node.getAttribute("data-bind"));
      if (typeof value === "string" && value) node.textContent = value;
    });

    $$("[data-bind-attr]").forEach(function (node) {
      node.getAttribute("data-bind-attr").split(",").forEach(function (pair) {
        var bits = pair.split(":");
        if (bits.length !== 2) return;
        var value = get(bits[1].trim());
        if (typeof value === "string" && value) node.setAttribute(bits[0].trim(), value);
      });
    });

    $$("[data-year]").forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });

    var notice = $("[data-sample-notice]");
    if (notice) {
      if (SITE.sampleNotice) {
        notice.textContent = SITE.sampleNotice;
      } else {
        notice.hidden = true;
      }
    }

    var footerNote = $("[data-footer-note]");
    if (footerNote && SITE.footerNote) footerNote.textContent = SITE.footerNote;
  });

  /* --------------------------------------------------------------- 主题 -- */
  var THEME_KEY = "portfolio.theme";

  function initTheme() {
    var root = document.documentElement;
    var button = $("[data-theme-toggle]");
    var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    var override = null;

    function current() {
      if (override) return override;
      var query = /[?&]theme=(dark|light)/.exec(window.location.search);
      if (query) return query[1];
      var stored = null;
      try {
        stored = window.localStorage.getItem(THEME_KEY);
      } catch (err) {
        stored = null;
      }
      if (stored === "light" || stored === "dark") return stored;
      return media && media.matches ? "dark" : "light";
    }

    function paint() {
      var mode = current();
      root.setAttribute("data-theme", mode);
      var meta = $('meta[name="theme-color"]');
      if (meta) {
        var color = mode === "dark" ? SITE.themeColorDark : SITE.themeColor;
        if (color) meta.setAttribute("content", color);
      }
      if (button) {
        var next = mode === "dark" ? "切换到浅色主题" : "切换到深色主题";
        button.setAttribute("aria-label", next);
        button.setAttribute("title", next);
      }
      /* 注意：SVG 元素没有 hidden IDL 属性，必须走属性 API + CSS 兜底 */
      $$("[data-theme-icon]").forEach(function (node) {
        if (node.getAttribute("data-theme-icon") === mode) {
          node.removeAttribute("hidden");
        } else {
          node.setAttribute("hidden", "");
        }
      });
    }

    if (button) {
      button.addEventListener("click", function () {
        var next = current() === "dark" ? "light" : "dark";
        override = next;
        try {
          window.localStorage.setItem(THEME_KEY, next);
        } catch (err) {
          /* 隐私模式下无法持久化：本次会话仍然生效 */
        }
        /* 地址栏里的 ?theme= 也要跟着走，否则刷新会回到旧主题 */
        if (/[?&]theme=/.test(window.location.search) && window.history && window.history.replaceState) {
          try {
            var url = new URL(window.location.href);
            url.searchParams.set("theme", next);
            window.history.replaceState(null, "", url.toString());
          } catch (err) {
            /* 老浏览器没有 URL 构造器：忽略，本次会话仍然生效 */
          }
        }
        paint();
      });
    }

    if (media && media.addEventListener) media.addEventListener("change", paint);
    paint();

    if (SITE.accent) root.setAttribute("data-accent", SITE.accent);
  }

  /* --------------------------------------------------------------- 导航 -- */
  /* 三处导航列表都由 site.nav 驱动：改 content.js 即可增删页面入口 */
  var renderNav = safe(function () {
    var nav = Array.isArray(SITE.nav) ? SITE.nav : [];
    if (!nav.length) return;

    [
      { host: $("[data-render='nav-links']"), list: false },
      { host: $("[data-render='nav-panel']"), list: true },
      { host: $("[data-render='footer-nav']"), list: true }
    ].forEach(function (target) {
      if (!target.host) return;
      var fragment = document.createDocumentFragment();
      nav.forEach(function (item) {
        if (!item || !item.href) return;
        var link = el("a", target.list ? null : "nav__link", item.label || item.href);
        link.href = item.href;
        link.setAttribute("data-nav-link", "");
        if (target.list) {
          var li = el("li");
          li.appendChild(link);
          fragment.appendChild(li);
        } else {
          fragment.appendChild(link);
        }
      });
      clear(target.host);
      target.host.appendChild(fragment);
    });
  });

  /* 站点级元信息：域名 / 语言 / 标题模板跟随 content.js（部署后只改一处） */
  var applyMeta = safe(function () {
    var base = (SITE.url || "").replace(/\/+$/, "");
    var page = window.location.pathname.split("/").pop() || "index.html";
    var pageLabel = document.body.getAttribute("data-page") || "";

    if (SITE.locale) document.documentElement.setAttribute("lang", SITE.locale);

    /* 首页用完整站点标题；其余页面用 "{page} · 作者" 模板 */
    if (page === "index.html" && SITE.title) {
      document.title = SITE.title;
    } else if (pageLabel && SITE.titleTemplate) {
      document.title = SITE.titleTemplate.replace("{page}", pageLabel);
    } else if (SITE.title) {
      document.title = SITE.title; /* 没有 data-page 的页面回退到站点标题 */
    }

    if (!base) return;
    var canonical = $('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute("href", page === "index.html" ? base + "/" : base + "/" + page);
    }
    $$('meta[property="og:url"]').forEach(function (node) {
      node.setAttribute("content", page === "index.html" ? base + "/" : base + "/" + page);
    });
    if (SITE.ogImage) {
      $$('meta[property="og:image"]').forEach(function (node) {
        node.setAttribute("content", base + "/" + SITE.ogImage);
      });
    }
  });

  function initNav() {
    var panel = $("[data-nav-panel]");
    var toggle = $("[data-nav-toggle]");
    var here = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

    $$("[data-nav-link]").forEach(function (link) {
      var href = (link.getAttribute("href") || "").toLowerCase();
      if (href === here) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (!panel || !toggle) return;

    function close() {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      var open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        /* 焦点移入面板，键盘用户不必再穿过主题按钮 */
        var firstLink = $("a", panel);
        if (firstLink) firstLink.focus();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) {
        close();
        toggle.focus();
      }
    });

    panel.addEventListener("click", function (event) {
      if (event.target.closest("a")) close();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 860 && !panel.hidden) close();
    });
  }

  /* ----------------------------------------------------- 首页右卡片 -- */
  var renderHeroCard = safe(function () {
    var host = $("[data-render='hero-card']");
    if (!host) return;
    var hero = PROFILE.hero || {};
    clear(host);
    host.appendChild(el("p", "eyebrow", "在线项目"));
    if (hero.intro) host.appendChild(el("p", "muted", hero.intro));
    var links = el("div", "stack");
    (hero.links || []).forEach(function (link) {
      var item = el("div", "hero-app");
      var a = el("a", "link-arrow", link.label || link.url || "");
      a.href = link.url || "#";
      a.target = "_blank";
      a.rel = "noopener";
      item.appendChild(a);
      if (link.desc) item.appendChild(el("p", "hero-app__desc", link.desc));
      links.appendChild(item);
    });
    if (links.childNodes.length) host.appendChild(links);
    if (hero.direction) host.appendChild(el("p", "mono muted", "方向：" + hero.direction));
  });

  /* --------------------------------------------------------- 学到什么 -- */
  var renderLearnings = safe(function () {
    var host = $("[data-render='learnings']");
    if (!host) return;
    var list = PROFILE.learnings || [];
    clear(host);
    list.forEach(function (item, index) {
      var card = el("div", "capability reveal");
      card.appendChild(el("p", "capability__index", String(index + 1).padStart(2, "0")));
      card.appendChild(el("h3", null, item.title || ""));
      card.appendChild(el("p", null, item.text || ""));
      host.appendChild(card);
    });
  });

  /* --------------------------------------------------------- 能做什么 -- */
  var renderCapabilities = safe(function () {
    var host = $("[data-render='capabilities']");
    if (!host) return;
    var list = PROFILE.capabilities || [];
    if (!list.length) return;
    var fragment = document.createDocumentFragment();
    list.forEach(function (item, index) {
      var card = el("div", "capability reveal");
      card.appendChild(el("p", "capability__index", String(index + 1).padStart(2, "0")));
      card.appendChild(el("h3", null, item.title || ""));
      card.appendChild(el("p", null, item.text || ""));
      fragment.appendChild(card);
    });
    clear(host);
    host.appendChild(fragment);
    observeReveals(host);
  });

  /* --------------------------------------------------------- 证据条 -- */
  var renderEvidence = safe(function () {
    var host = $("[data-render='evidence']");
    if (!host) return;
    var list = PROFILE.evidence || [];
    if (!list.length) return;
    var fragment = document.createDocumentFragment();
    list.forEach(function (item) {
      var card = el("div", "evidence reveal");
      card.appendChild(el("p", "evidence__value", item.value || ""));
      if (item.url) {
        var link = el("a", "evidence__label", item.label || item.url);
        link.href = item.url;
        link.rel = "noopener";
        if (/^https?:/i.test(item.url)) link.target = "_blank";
        card.appendChild(link);
      } else {
        card.appendChild(el("p", "evidence__label", item.label || ""));
      }
      if (item.note) card.appendChild(el("p", "evidence__note", item.note || ""));
      fragment.appendChild(card);
    });
    clear(host);
    host.appendChild(fragment);
    observeReveals(host);
  });

  /* ----------------------------------------------------------- 作品卡片 -- */
  function projectCard(project) {
    var card = el("a", "project-card reveal");
    card.href = "project.html?id=" + encodeURIComponent(project.id || "");

    var media = el("div", "project-card__media");
    if (project.cover) {
      var img = el("img");
      img.src = project.cover;
      img.alt = project.title ? project.title + " 封面" : "";
      img.loading = "lazy";
      img.decoding = "async";
      media.appendChild(img);
    }
    card.appendChild(media);

    var body = el("div", "project-card__body");

    var top = el("div", "project-card__top");
    top.appendChild(el("h3", "project-card__title", project.title || "未命名项目"));
    if (project.year) top.appendChild(el("span", "project-card__year", project.year));
    body.appendChild(top);

    if (project.summary) body.appendChild(el("p", "project-card__summary", project.summary));

    var foot = el("div", "project-card__foot");
    var tags = el("div", "tag-list");
    (project.tags || []).slice(0, 2).forEach(function (tag) {
      tags.appendChild(el("span", "tag", tag));
    });
    foot.appendChild(tags);

    var more = el("span", "project-card__more");
    more.appendChild(document.createTextNode(label("viewProject", "查看项目")));
    more.appendChild(icon("arrow"));
    foot.appendChild(more);

    body.appendChild(foot);
    card.appendChild(body);
    return card;
  }

  var renderFeatured = safe(function () {
    var host = $("[data-render='featured-projects']");
    if (!host) return;
    var pool = visibleProjects();
    var featured = pool.filter(function (project) {
      return project.featured;
    });
    var list = (featured.length ? featured : pool).slice(0, 3);
    if (!list.length) return;
    var fragment = document.createDocumentFragment();
    list.forEach(function (project) {
      fragment.appendChild(projectCard(project));
    });
    clear(host);
    host.appendChild(fragment);
  });

  /* --------------------------------------------------------- 作品列表页 -- */
  var renderProjectsPage = safe(function () {
    var appsHost = $("[data-render='group-apps']");
    var labHost = $("[data-render='group-lab']");
    if (!appsHost && !labHost) return;

    var pool = visibleProjects();
    var apps = pool.filter(function (project) {
      return project.group !== "lab";
    });
    var lab = pool.filter(function (project) {
      return project.group === "lab";
    });

    function fill(host, list) {
      if (!host) return;
      var fragment = document.createDocumentFragment();
      list.forEach(function (project) {
        fragment.appendChild(projectCard(project));
      });
      clear(host);
      host.appendChild(fragment);
      observeReveals(host);
    }

    fill(appsHost, apps);
    fill(labHost, lab);

    /* 某一组为空时隐藏组标题，避免出现空区块 */
    var labHead = $("[data-lab-head]");
    var labEmpty = lab.length === 0;
    if (labHead) labHead.hidden = labEmpty;
    if (labHost) labHost.hidden = labEmpty;
    if (appsHost) appsHost.hidden = apps.length === 0;
  });

  /* ------------------------------------------------------------- 详情页 -- */
  var renderDetail = safe(function () {
    var host = $("[data-render='project-detail']");
    if (!host) return;

    var params = new URLSearchParams(window.location.search);
    var id = params.get("id");
    var pool = visibleProjects();
    var index = -1;

    pool.forEach(function (project, i) {
      if (project.id === id) index = i;
    });

    if (index === -1) {
      /* id 不存在、被删掉、或标了 hidden: true —— 一律按"没有这个项目"处理 */
      var empty = $("[data-render='project-missing']");
      if (empty) empty.hidden = false;
      host.hidden = true;
      document.title = label("notFoundProject", "没有找到这个项目") + " · " + (SITE.author || "");
      return;
    }

    var project = pool[index];
    var detail = project.detail || {};
    var missing = $("[data-render='project-missing']");
    if (missing) missing.hidden = true;

    document.title = (project.title || "项目") + " · " + (SITE.author || "");

    var desc = $('meta[name="description"]');
    if (desc && project.summary) desc.setAttribute("content", project.summary);

    /* 详情页的 canonical / og 跟随 ?id=：否则多个项目共用同一份分享元数据 */
    var shareUrl = (SITE.url || "") + "/project.html?id=" + encodeURIComponent(project.id || "");
    var canonicalNode = $('link[rel="canonical"]');
    if (canonicalNode) canonicalNode.setAttribute("href", shareUrl);
    $$('meta[property="og:url"]').forEach(function (node) {
      node.setAttribute("content", shareUrl);
    });
    var ogTitle = $('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", project.title || SITE.title || "");
    var ogDesc = $('meta[property="og:description"]');
    if (ogDesc && project.summary) ogDesc.setAttribute("content", project.summary);

    function fill(selector, value) {
      /* 同一钩子可能在页面上出现多次（如年份同时出现在 eyebrow 与信息表），全部填充 */
      $$(selector).forEach(function (node) {
        node.textContent = value || "";
      });
    }

    fill("[data-detail='title']", project.title);
    fill("[data-detail='summary']", project.summary);
    fill("[data-detail='year']", project.year);
    fill("[data-detail='role']", project.role);
    fill("[data-detail='background']", detail.background);
    fill("[data-detail='contribution']", detail.contribution);
    fill("[data-detail='decisions']", detail.decisions);
    fill("[data-detail='verification']", detail.verification);
    fill("[data-detail='outcome']", detail.outcome);
    fill("[data-detail='next']", detail.next);

    /* 实现链路：详情页的可视化证据链（有数据才显示） */
    var flowSteps = Array.isArray(detail.flow) ? detail.flow : [];
    var flowHost = $("[data-detail='flow']");
    if (flowHost) {
      clear(flowHost);
      flowSteps.forEach(function (step) {
        flowHost.appendChild(el("li", "flow__step", step));
      });
      flowHost.hidden = flowSteps.length === 0;
    }
    var flowBlock = $("[data-flow-block]");
    if (flowBlock) flowBlock.hidden = flowSteps.length === 0;


    var cover = $("[data-detail='cover']");
    if (cover) {
      var figure = cover.closest("figure");
      if (project.cover) {
        cover.src = project.cover;
        cover.alt = (project.title || "项目") + " 封面";
        cover.removeAttribute("hidden");
        if (figure) figure.removeAttribute("hidden");
      } else {
        cover.setAttribute("hidden", "");
        if (figure) figure.setAttribute("hidden", "");
      }
    }

    var tags = Array.isArray(project.tags) ? project.tags : [];
    var tagHost = $("[data-detail='tags']");
    if (tagHost && tags.length) {
      var tagFragment = document.createDocumentFragment();
      tags.forEach(function (tag) {
        tagFragment.appendChild(el("span", "tag", tag));
      });
      clear(tagHost);
      tagHost.appendChild(tagFragment);
    }

    var highlights = Array.isArray(project.highlights) ? project.highlights : [];
    var listHost = $("[data-detail='highlights']");
    var listWrap = listHost ? listHost.closest("[data-detail='highlights-wrap']") : null;
    if (listWrap) listWrap.hidden = highlights.length === 0;
    if (listHost && highlights.length) {
      var listFragment = document.createDocumentFragment();
      highlights.forEach(function (item) {
        listFragment.appendChild(el("li", null, item));
      });
      clear(listHost);
      listHost.appendChild(listFragment);
    }

    var evidence = (Array.isArray(project.evidence) ? project.evidence : []).filter(function (item) {
      return item && (item.label || item.url);
    });
    var evidenceHost = $("[data-detail='evidence']");
    var evidenceWrap = evidenceHost ? evidenceHost.closest("[data-detail='evidence-wrap']") : null;
    if (evidenceWrap) evidenceWrap.hidden = evidence.length === 0;
    if (evidenceHost && evidence.length) {
      var evidenceFragment = document.createDocumentFragment();
      evidence.forEach(function (item) {
        var row = el("li");
        if (item.url) {
          var a = el("a", null, item.label || item.url);
          a.href = item.url;
          a.rel = "noopener";
          if (/^https?:/i.test(item.url)) a.target = "_blank";
          row.appendChild(a);
        } else {
          row.appendChild(document.createTextNode(item.label || ""));
        }
        if (item.note) row.appendChild(el("p", "field__hint", item.note));
        evidenceFragment.appendChild(row);
      });
      clear(evidenceHost);
      evidenceHost.appendChild(evidenceFragment);
    }

    var links = (Array.isArray(project.links) ? project.links : []).filter(function (link) {
      return link && link.url;
    });
    var linkHost = $("[data-detail='links']");
    var linksWrap = linkHost ? linkHost.closest("[data-detail='links-wrap']") : null;
    if (linksWrap) linksWrap.hidden = links.length === 0;
    if (linkHost && links.length) {
      var linkFragment = document.createDocumentFragment();
      links.forEach(function (link) {
        var a = el("a", "btn btn--ghost");
        a.href = link.url;
        a.rel = "noopener";
        if (/^https?:/i.test(link.url)) a.target = "_blank";
        a.appendChild(document.createTextNode(link.label || link.url));
        a.appendChild(icon("external"));
        linkFragment.appendChild(a);
      });
      clear(linkHost);
      linkHost.appendChild(linkFragment);
    }

    /* 在线体验：详情页顶部主入口；没有演示链接的项目（如 AI-OS）不显示 */
    var demoHost = $("[data-detail='demo-cta']");
    var demoLink = links.filter(function (link) {
      return /演示|体验/.test(link.label || "");
    })[0];
    if (demoHost) {
      clear(demoHost);
      if (demoLink) {
        var demoBtn = el("a", "btn btn--primary");
        demoBtn.href = demoLink.url;
        demoBtn.rel = "noopener";
        if (/^https?:/i.test(demoLink.url)) demoBtn.target = "_blank";
        demoBtn.appendChild(el("span", "btn__label", "在线体验 · 打开演示"));
        demoBtn.appendChild(icon("external"));
        demoHost.appendChild(demoBtn);
      }
      demoHost.hidden = !demoLink;
    }

    var demoNoteHost = $("[data-detail='demo-note']");
    if (demoNoteHost) {
      demoNoteHost.textContent = project.demoNote || "";
      demoNoteHost.hidden = !project.demoNote;
    }

    var pager = $("[data-detail='pager']");
    if (pager && pool.length > 2) {
      /* 只有两个项目时"上一个"与"下一个"是同一项，此时不渲染分页 */
      var prev = pool[(index - 1 + pool.length) % pool.length];
      var next = pool[(index + 1) % pool.length];
      var pagerFragment = document.createDocumentFragment();
      [
        { project: prev, dir: "上一个" },
        { project: next, dir: "下一个" }
      ].forEach(function (item) {
        var a = el("a", "link-arrow");
        a.href = "project.html?id=" + encodeURIComponent(item.project.id || "");
        a.appendChild(document.createTextNode(item.dir + "：" + (item.project.title || "")));
        a.appendChild(icon("arrow"));
        pagerFragment.appendChild(a);
      });
      clear(pager);
      pager.appendChild(pagerFragment);
    }
  });

  /* ------------------------------------------------------------- 关于页 -- */
  var renderAbout = safe(function () {
    var skillHost = $("[data-render='skills']");
    var groups = Array.isArray(PROFILE.skillGroups) ? PROFILE.skillGroups : [];
    if (skillHost && groups.length) {
      var skillFragment = document.createDocumentFragment();
      groups.forEach(function (group) {
        var card = el("div", "card");
        card.appendChild(el("h3", "capability__index", group.group || ""));
        var list = el("div", "tag-list");
        (Array.isArray(group.items) ? group.items : []).forEach(function (item) {
          list.appendChild(el("span", "tag", item));
        });
        card.appendChild(list);
        skillFragment.appendChild(card);
      });
      clear(skillHost);
      skillHost.appendChild(skillFragment);
    }

    var timelineHost = $("[data-render='timeline']");
    var jobs = Array.isArray(PROFILE.experience) ? PROFILE.experience : [];
    if (timelineHost && jobs.length) {
      var jobFragment = document.createDocumentFragment();
      jobs.forEach(function (job) {
        var item = el("li", "timeline__item" + (job.current ? " timeline__item--current" : ""));
        item.appendChild(el("p", "timeline__period", job.period || ""));
        item.appendChild(el("h3", "timeline__role", job.role || ""));
        item.appendChild(el("p", "timeline__org", job.company || ""));
        if (job.summary) item.appendChild(el("p", "timeline__org", job.summary));
        if (Array.isArray(job.highlights) && job.highlights.length) {
          var ul = el("ul", "timeline__points");
          job.highlights.forEach(function (point) {
            ul.appendChild(el("li", null, point));
          });
          item.appendChild(ul);
        }
        jobFragment.appendChild(item);
      });
      clear(timelineHost);
      timelineHost.appendChild(jobFragment);
    }

    var eduHost = $("[data-render='education']");
    var education = Array.isArray(PROFILE.education) ? PROFILE.education : [];
    if (eduHost && education.length) {
      var eduFragment = document.createDocumentFragment();
      education.forEach(function (item) {
        var row = el("div", "contact-row");
        var left = el("div");
        left.appendChild(el("p", "contact-row__value", item.school || ""));
        left.appendChild(el("p", "field__hint", item.degree || ""));
        row.appendChild(left);
        row.appendChild(el("span", "mono muted", item.period || ""));
        eduFragment.appendChild(row);
      });
      clear(eduHost);
      eduHost.appendChild(eduFragment);
    }


    var positioningHost = $("[data-render='positioning']");
    var positioning = Array.isArray(PROFILE.positioning) ? PROFILE.positioning : [];
    if (positioningHost && positioning.length) {
      var positioningFragment = document.createDocumentFragment();
      positioning.forEach(function (paragraph) {
        positioningFragment.appendChild(el("p", null, paragraph));
      });
      clear(positioningHost);
      positioningHost.appendChild(positioningFragment);
    }

    var bioHost = $("[data-render='bio']");
    var bio = Array.isArray(PROFILE.bioLong) ? PROFILE.bioLong : [];
    if (bioHost && bio.length) {
      var bioFragment = document.createDocumentFragment();
      bio.forEach(function (paragraph) {
        bioFragment.appendChild(el("p", null, paragraph));
      });
      clear(bioHost);
      bioHost.appendChild(bioFragment);
    }
  });

  /* ------------------------------------------------------------- 联系页 -- */
  function socialRows(host) {
    var socials = Array.isArray(PROFILE.socials) ? PROFILE.socials : [];
    if (!socials.length) return; /* 保留 HTML 里的静态骨架 */
    var fragment = document.createDocumentFragment();
    socials.forEach(function (item) {
      var row = el("div", "contact-row");
      var left = el("div");
      left.appendChild(el("p", "contact-row__label", item.label || ""));
      var value = el("p", "contact-row__value");
      var text = item.handle || item.url || item.label || "";
      if (item.url) {
        var link = el("a", null, text);
        link.href = item.url;
        if (/^https?:/i.test(item.url)) {
          link.rel = "noopener";
          link.target = "_blank";
        }
        value.appendChild(link);
      } else {
        value.appendChild(document.createTextNode(text)); /* 没有链接就不做成可点的空链接 */
      }
      left.appendChild(value);
      row.appendChild(left);
      if (/^https?:/i.test(item.url || "")) {
        var action = el("a", "btn btn--icon contact-row__action");
        action.href = item.url;
        action.target = "_blank";
        action.rel = "noopener";
        action.setAttribute("aria-label", "在新标签页打开 " + (item.label || ""));
        action.appendChild(icon("external"));
        row.appendChild(action);
      }
      fragment.appendChild(row);
    });
    clear(host);
    host.appendChild(fragment);
  }

  function toast(message) {
    var host = $("[data-toast]");
    if (!host) return;
    clear(host);
    var body = el("div", "toast__body");
    body.appendChild(icon("check"));
    body.appendChild(document.createTextNode(message));
    host.appendChild(body);
    host.hidden = false;
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(function () {
      host.hidden = true;
    }, 2600);
  }

  var renderContact = safe(function () {
    var email = PROFILE.email || "";
    /* 同一页可能有多处邮箱（联系页正文 + 页脚），全部同步 */
    $$("[data-contact='email-link']").forEach(function (link) {
      if (!email) return;
      link.href = "mailto:" + email;
      link.textContent = email;
    });

    var copyBtn = $("[data-contact='copy-email']");
    if (copyBtn) {
      if (!email) {
        copyBtn.hidden = true;
      } else {
        copyBtn.addEventListener("click", function () {
          function done(ok) {
            toast(ok ? label("copied", "邮箱已复制到剪贴板") : label("copyFailed", "复制失败，请手动选中邮箱地址"));
          }
          function fallback() {
            var area = el("textarea", "visually-hidden");
            area.value = email;
            document.body.appendChild(area);
            area.select();
            var ok = false;
            try {
              ok = document.execCommand("copy");
            } catch (err) {
              ok = false;
            }
            document.body.removeChild(area);
            done(ok);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(email).then(function () {
              done(true);
            }, fallback);
          } else {
            fallback();
          }
        });
      }
    }

    var socialHost = $("[data-render='socials']");
    if (socialHost) socialRows(socialHost);

    var meta = $("[data-render='contact-meta']");
    var metaRows = [
      { label: "所在地", value: PROFILE.location || "" },
      { label: "状态", value: PROFILE.availability || "" }
    ].filter(function (item) {
      return item.value;
    });
    if (meta && metaRows.length) {
      var metaFragment = document.createDocumentFragment();
      metaRows.forEach(function (item) {
        var row = el("div", "contact-row");
        var left = el("div");
        left.appendChild(el("p", "contact-row__label", item.label));
        left.appendChild(el("p", "contact-row__value", item.value));
        row.appendChild(left);
        metaFragment.appendChild(row);
      });
      clear(meta);
      meta.appendChild(metaFragment);
    }

    initForm(email);
  });

  function initForm(email) {
    var form = $("[data-contact-form]");
    if (!form) return;
    var status = $("[data-form-status]");

    /* 无 JS 时表单走原生提交：目标邮箱跟随内容数据一起更新 */
    if (email) form.setAttribute("action", "mailto:" + email);

    /* 没有配置邮箱时不要假装能发信：禁用提交并说明原因 */
    if (!email) {
      var submitButton = $("button[type='submit']", form);
      if (submitButton) submitButton.disabled = true;
      if (status) status.textContent = "站点还没配置邮箱地址，暂时无法通过表单联系。";
      return;
    }

    /* JS 可用时把校验交回自定义 UI（内联错误、aria-invalid、错误计数）；
       JS 不可用时 HTML 的 required / minlength 仍由浏览器原生兜底。
       用属性而不是 HTML 的 novalidate，才能同时拿到这两条路径。 */
    form.noValidate = true;

    function setError(field, message) {
      var wrap = field.closest(".field");
      var box = wrap ? $(".field__error", wrap) : null;
      if (wrap) wrap.setAttribute("data-invalid", message ? "true" : "false");
      field.setAttribute("aria-invalid", message ? "true" : "false");
      if (box) box.textContent = message || "";
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = $("#contact-name");
      var from = $("#contact-email");
      var message = $("#contact-message");
      var firstBad = null;
      var badCount = 0;

      if (!name || !from || !message) {
        /* 字段被改名或删除：把校验交回浏览器，至少不会静默失败 */
        form.noValidate = false;
        if (status) status.textContent = "表单结构已变化，请直接写邮件到 " + email + "。";
        return;
      }

      function check(field, condition, text) {
        var bad = condition ? "" : text;
        setError(field, bad);
        if (bad) {
          badCount += 1;
          if (!firstBad) firstBad = field;
        }
      }

      check(name, name.value.trim().length > 0, "请填写称呼，方便我知道怎么回复。");
      check(
        from,
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from.value.trim()),
        "请填写可用的邮箱地址，例如 name@example.com。"
      );
      check(message, message.value.trim().length >= 10, "请多写几句（至少 10 个字），我才能判断怎么帮你。");

      if (firstBad) {
        firstBad.focus();
        if (status) {
          status.textContent =
            badCount === 1
              ? "还有 1 项需要修改，已在对应输入框下说明。"
              : "还有 " + badCount + " 项需要修改，已在对应输入框下说明。";
        }
        return;
      }

      var subject = "来自作品集的联系：" + name.value.trim();
      var body = message.value.trim() + "\n\n—— " + name.value.trim() + " / " + from.value.trim();
      window.location.href =
        "mailto:" +
        email +
        "?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);
      if (status) status.textContent = "已打开你的邮件客户端；如果没反应，请直接写邮件到 " + email + "。";
    });

    $$("input, textarea", form).forEach(function (field) {
      field.addEventListener("input", function () {
        if (field.getAttribute("aria-invalid") === "true") setError(field, "");
      });
    });
  }

  /* ------------------------------------------------------------ 写作区块 -- */
  var renderWriting = safe(function () {
    var section = $("[data-writing-section]");
    if (!section) return;
    if (!WRITING.length) {
      section.hidden = true;
      return;
    }
    var host = $("[data-render='writing']", section);
    if (!host) return;
    section.hidden = false;
    clear(host);
    WRITING.forEach(function (item) {
      var card = item.url ? el("a", "card reveal") : el("div", "card reveal");
      if (item.url) card.href = item.url;
      card.appendChild(el("p", "capability__index", item.date || ""));
      card.appendChild(el("h3", null, item.title || ""));
      card.appendChild(el("p", "muted", item.summary || ""));
      host.appendChild(card);
    });
    observeReveals(host);
  });

  /* -------------------------------------------------------------- 入场动效 */
  var revealObserver = null;

  function observeReveals(root) {
    var nodes = $$(".reveal:not(.is-visible)", root || document);
    var reduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || !("IntersectionObserver" in window)) {
      nodes.forEach(function (node) {
        node.classList.add("is-visible");
      });
      return;
    }

    if (!revealObserver) {
      try {
        revealObserver = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                revealObserver.unobserve(entry.target);
              }
            });
          },
          { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
        );
      } catch (err) {
        revealObserver = null;
      }
    }

    if (!revealObserver) {
      /* 观察器建不起来时立刻显示，绝不让内容停在 opacity: 0 */
      nodes.forEach(function (node) {
        node.classList.add("is-visible");
      });
      return;
    }

    nodes.forEach(function (node) {
      revealObserver.observe(node);
    });
  }

  /* ------------------------------------------------------------ 打印按钮 -- */
  function initPrint() {
    $$("[data-print]").forEach(function (button) {
      button.addEventListener("click", function () {
        window.print();
      });
    });
  }

  /* ---------------------------------------------------------------- 启动 -- */
  function boot() {
    bindTexts();
    initTheme();
    renderNav();
    applyMeta();
    initNav();
    renderHeroCard();
    renderLearnings();
    renderCapabilities();
    renderEvidence();
    renderFeatured();
    renderProjectsPage();
    renderDetail();
    renderAbout();
    renderContact();
    renderWriting();
    initPrint();
    observeReveals(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
