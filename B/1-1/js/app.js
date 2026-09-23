"use strict";

// 1. 설정, DOM, 상태. 모든 기능은 이벤트 → 상태 변경 → 렌더링으로 이어집니다.
(() => {
  const {
    githubUsername,
    cacheMinutes,
    requestTimeoutMs,
    headerScrollThreshold,
    backToTopThreshold,
    revealThreshold,
  } = PORTFOLIO_CONFIG;

  const themeKey = "zero-portfolio-theme";
  const cacheKey = `zero-portfolio-repos:${githubUsername}:v1`;
  const colorPreference = window.matchMedia("(prefers-color-scheme: dark)");
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopNavigation = window.matchMedia("(min-width: 768px)");
  const fields = ["name", "email", "message"];
  const dom = {
    header: document.querySelector("#site-header"),
    menuButton: document.querySelector("#menu-toggle"),
    menu: document.querySelector("#nav-links"),
    navLinks: [...document.querySelectorAll(".nav-link")],
    themeButton: document.querySelector("#theme-toggle"),
    themeIcon: document.querySelector(".theme-icon use"),
    topButton: document.querySelector("#back-to-top"),
    projectGrid: document.querySelector("#projects-grid"),
    projectStatus: document.querySelector("#project-status"),
    projectFilters: document.querySelector("#project-filters"),
    projectCount: document.querySelector("#project-count"),
    projectFootnote: document.querySelector("#project-footnote"),
    form: document.querySelector("#contact-form"),
    formFeedback: document.querySelector("#form-feedback"),
    messageCount: document.querySelector("#message-count"),
    sections: [...document.querySelectorAll("main > section[id]")],
  };

  // 저장소가 차단된 브라우저에서도 나머지 기능은 동작합니다.
  const readSavedTheme = () => {
    try {
      const saved = localStorage.getItem(themeKey);
      return ["light", "dark"].includes(saved) ? saved : null;
    } catch {
      return null;
    }
  };

  const savedTheme = readSavedTheme();
  const state = {
    theme: savedTheme ?? (colorPreference.matches ? "dark" : "light"),
    followsSystemTheme: savedTheme === null,
    menuOpen: false,
    headerScrolled: false,
    backToTopVisible: false,
    activeSection: "hero",
    projects: { status: "idle", repositories: [], filter: "all", error: "", source: "network" },
    form: {
      values: { name: "", email: "", message: "" },
      errors: { name: "", email: "", message: "" },
      touched: { name: false, email: false, message: false },
      submitted: false,
      successful: false,
    },
  };

  // 2. 테마: 클릭 → state.theme → data-theme와 버튼 접근성 업데이트.
  const renderTheme = () => {
    const isDark = state.theme === "dark";
    document.documentElement.dataset.theme = state.theme;
    dom.themeButton.setAttribute("aria-pressed", String(isDark));
    dom.themeButton.setAttribute("aria-label", isDark ? "라이트 모드로 전환" : "다크 모드로 전환");
    dom.themeIcon.setAttribute("href", isDark ? "#icon-sun" : "#icon-moon");
    document.querySelector('meta[name="theme-color"]').content = isDark ? "#101623" : "#f8faff";
  };

  dom.themeButton.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    state.followsSystemTheme = false;
    renderTheme();
    try {
      localStorage.setItem(themeKey, state.theme);
    } catch {
      // 현재 탭의 테마는 유지하되, 저장에 실패해도 화면 동작을 막지 않습니다.
    }
  });

  colorPreference.addEventListener("change", ({ matches }) => {
    if (!state.followsSystemTheme) return;
    state.theme = matches ? "dark" : "light";
    renderTheme();
  });

  // 3. 모바일 메뉴와 앵커 이동. 모바일 메뉴는 dialog가 아닌 disclosure입니다.
  const renderMenu = () => {
    dom.menu.classList.toggle("active", state.menuOpen);
    dom.menuButton.classList.toggle("active", state.menuOpen);
    dom.menuButton.setAttribute("aria-expanded", String(state.menuOpen));
    dom.menuButton.setAttribute("aria-label", state.menuOpen ? "메뉴 닫기" : "메뉴 열기");
  };

  const closeMenu = () => {
    state.menuOpen = false;
    renderMenu();
  };

  dom.menuButton.addEventListener("click", () => {
    state.menuOpen = !state.menuOpen;
    renderMenu();
  });
  document.addEventListener("keydown", ({ key }) => {
    if (key === "Escape" && state.menuOpen) {
      closeMenu();
      dom.menuButton.focus();
    }
  });
  document.addEventListener("click", ({ target }) => {
    if (state.menuOpen && !dom.header.contains(target)) closeMenu();
  });
  dom.header.addEventListener("focusout", ({ relatedTarget }) => {
    if (state.menuOpen && relatedTarget && !dom.header.contains(relatedTarget)) closeMenu();
  });
  desktopNavigation.addEventListener("change", closeMenu);

  const scrollBehavior = () => motionPreference.matches ? "instant" : "smooth";
  const clearSectionFocus = ({ currentTarget }) => currentTarget.removeAttribute("tabindex");
  const focusSection = (target) => {
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    // 같은 콜백을 재사용하면 동일 섹션을 반복 선택해도 리스너가 중복되지 않습니다.
    target.addEventListener("blur", clearSectionFocus, { once: true });
  };

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const hash = link.getAttribute("href");
      const target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      closeMenu();
      focusSection(target);
      target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      if (window.location.hash !== hash) history.pushState(null, "", hash);
    });
  });

  // 4. 스크롤: 한 프레임에 한 번만 상태와 DOM을 업데이트합니다.
  const renderScroll = () => {
    dom.header.classList.toggle("scrolled", state.headerScrolled);
    dom.topButton.hidden = !state.backToTopVisible;
    dom.navLinks.forEach((link) => {
      if (link.getAttribute("href") === `#${state.activeSection}`) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const updateScroll = () => {
    state.headerScrolled = window.scrollY >= headerScrollThreshold;
    state.backToTopVisible = window.scrollY >= backToTopThreshold;
    const marker = dom.header.offsetHeight + 100;
    state.activeSection = dom.sections.reduce((current, section) => (
      section.getBoundingClientRect().top <= marker ? section.id : current
    ), "hero");
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      state.activeSection = "contact";
    }
    renderScroll();
  };

  let scrollScheduled = false;
  window.addEventListener("scroll", () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    window.requestAnimationFrame(() => {
      updateScroll();
      scrollScheduled = false;
    });
  }, { passive: true });
  window.addEventListener("resize", updateScroll);
  window.addEventListener("pageshow", updateScroll);
  dom.topButton.addEventListener("click", () => {
    closeMenu();
    focusSection(document.querySelector("#hero"));
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    if (window.location.hash) history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  });

  // 5. Intersection Observer: 보이는 요소만 등장시킨 뒤 관찰을 해제합니다.
  const setupReveal = () => {
    if (!("IntersectionObserver" in window) || motionPreference.matches) return;
    let observedCount = 0;
    const stopObserving = () => {
      observer.disconnect();
      motionPreference.removeEventListener("change", onMotionChange);
    };
    const onMotionChange = ({ matches }) => {
      if (!matches) return;
      stopObserving();
      document.querySelectorAll(".reveal-pending").forEach((element) => element.classList.remove("reveal-pending"));
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting || !target.classList.contains("reveal-pending")) return;
        target.classList.remove("reveal-pending");
        target.classList.add("reveal-visible");
        observer.unobserve(target);
        observedCount -= 1;
      });
      if (observedCount === 0) stopObserving();
    }, { threshold: revealThreshold });

    document.querySelectorAll(".reveal").forEach((element) => {
      // 긴 요소도 200% 확대나 낮은 화면 높이에서 충분히 관찰할 수 있도록 합니다.
      if (element.getBoundingClientRect().height * revealThreshold > window.innerHeight * 0.75) return;
      element.classList.add("reveal-pending");
      observedCount += 1;
      observer.observe(element);
    });
    if (observedCount > 0) motionPreference.addEventListener("change", onMotionChange);
    else stopObserving();
  };

  // 6. API 데이터는 외부 입력이므로 텍스트를 이스케이프한 뒤 템플릿에 넣습니다.
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);

  const languageName = ({ language }) => language || "기타";
  const defaultDescriptions = {
    "main-cource": "웹 기초부터 하나씩 완성해 가는 학습 프로젝트 모음입니다.",
    codyssey: "Python 기초를 익히며 쌓아가는 코디세이 학습 기록입니다.",
    "codyssey-docker": "Docker 학습을 위한 공개 저장소입니다.",
  };

  const projectCard = ({ name, description, language, stargazers_count }) => {
    const url = `https://github.com/${encodeURIComponent(githubUsername)}/${encodeURIComponent(name)}`;
    const label = escapeHTML(language || "기타");
    const languageClass = ({ Python: "python", JavaScript: "javascript", HTML: "html", CSS: "css" })[language] || "";
    return `
      <article class="project-card">
        <div class="project-card-top">
          <span class="project-folder"><svg class="icon" aria-hidden="true"><use href="#icon-folder"/></svg></span>
          <a class="project-open" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(name)} 저장소 열기 (새 탭)"><svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg></a>
        </div>
        <h3><a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHTML(name)}<span class="sr-only"> (새 탭)</span></a></h3>
        <p class="project-description">${escapeHTML(description || defaultDescriptions[name] || "GitHub에 공개한 프로젝트입니다. 저장소에서 코드를 확인해 보세요.")}</p>
        <div class="project-meta"><span class="project-language"><span class="language-dot ${languageClass}" aria-hidden="true"></span>${label}</span><span class="project-stars"><svg class="icon small-icon" aria-hidden="true"><use href="#icon-star"/></svg><span class="sr-only">스타 </span>${stargazers_count}</span></div>
      </article>`;
  };

  const renderFilters = () => {
    const { repositories, filter } = state.projects;
    const languages = [...new Set(repositories.map(languageName))].sort((a, b) => a.localeCompare(b, "ko"));
    const options = [{ value: "all", label: "전체" }, ...languages.map((language) => ({ value: language, label: language }))];
    dom.projectFilters.innerHTML = options.map(({ value, label }) => `
      <button class="filter-button${filter === value ? " active" : ""}" type="button" data-language="${escapeHTML(value)}" aria-pressed="${filter === value}">${escapeHTML(label)}</button>
    `).join("");
  };

  const renderProjects = () => {
    const { status, repositories, filter, error, source } = state.projects;
    const visible = repositories.filter((repository) => filter === "all" || languageName(repository) === filter);
    dom.projectGrid.setAttribute("aria-busy", String(status === "loading"));
    dom.projectGrid.innerHTML = "";
    dom.projectStatus.hidden = false;
    dom.projectFilters.hidden = status !== "success";
    dom.projectCount.textContent = "";

    if (status === "loading") {
      dom.projectStatus.innerHTML = '<span class="spinner" aria-hidden="true"></span><p>프로젝트를 불러오는 중입니다.</p>';
    } else if (status === "error") {
      dom.projectStatus.innerHTML = `<h3>프로젝트를 불러올 수 없습니다.</h3><p>${escapeHTML(error)}</p><button class="button button-secondary" type="button" data-action="retry">다시 시도</button>`;
    } else {
      dom.projectCount.textContent = `${visible.length} PROJECT${visible.length === 1 ? "" : "S"}`;
      if (visible.length === 0) {
        dom.projectStatus.innerHTML = '<h3>표시할 프로젝트가 없습니다.</h3><p>공개 저장소가 추가되면 이곳에서 확인할 수 있습니다.</p>';
      } else {
        dom.projectStatus.hidden = true;
        dom.projectGrid.innerHTML = visible.map(projectCard).join("");
      }
    }

    dom.projectFootnote.textContent = source === "cache" && status === "success"
      ? `GitHub API · 최근 ${cacheMinutes}분 내 불러온 목록 · Fork 저장소 제외`
      : "GitHub API · 최신 업데이트 순 · Fork 저장소 제외";
  };

  // 최소한의 필드만 저장합니다. 토큰, 사용자 입력, 연락처는 저장하지 않습니다.
  const normalizeRepositories = (repositories) => repositories
    .filter((repository) => repository && typeof repository.name === "string"
      && repository.private === false && repository.fork === false && repository.archived === false)
    .map(({ id, name, description, language, stargazers_count }) => ({
      id,
      name,
      description: typeof description === "string" ? description : "",
      language: typeof language === "string" ? language : null,
      stargazers_count: Number.isFinite(stargazers_count) ? Math.max(0, stargazers_count) : 0,
    }));

  const readRepositoryCache = () => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey));
      if (!cached || !Number.isFinite(cached.savedAt) || cached.savedAt > Date.now()
        || Date.now() - cached.savedAt > cacheMinutes * 60 * 1000 || !Array.isArray(cached.repositories)) return null;
      const valid = cached.repositories.every((repo) => repo && typeof repo.name === "string"
        && typeof repo.description === "string" && (repo.language === null || typeof repo.language === "string")
        && Number.isFinite(repo.stargazers_count));
      return valid ? cached.repositories : null;
    } catch {
      return null;
    }
  };

  const loadProjects = async ({ force = false } = {}) => {
    if (state.projects.status === "loading") return;
    state.projects.status = "loading";
    state.projects.error = "";
    state.projects.source = "network";
    renderProjects();

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const cached = force ? null : readRepositoryCache();
      if (cached) {
        state.projects.repositories = cached;
        state.projects.source = "cache";
      } else {
        // 공개 /users 엔드포인트만 사용하며, 쿠키나 인증 토큰은 보내지 않습니다.
        const response = await fetch(`https://api.github.com/users/${encodeURIComponent(githubUsername)}/repos?sort=updated&direction=desc&per_page=100&type=owner`, {
          headers: { Accept: "application/vnd.github+json" },
          credentials: "omit",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 403 || response.status === 429) {
            throw new Error("GitHub 요청 한도에 도달했거나 접근이 제한되었습니다. 잠시 후 다시 시도해 주세요.");
          }
          if (response.status === 404) throw new Error("GitHub 계정을 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.");
          throw new Error(`GitHub가 요청을 처리하지 못했습니다. (오류 ${response.status})`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("GitHub 응답 형식이 올바르지 않습니다.");
        state.projects.repositories = normalizeRepositories(data);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), repositories: state.projects.repositories }));
        } catch {
          // 캐시는 요청 절약을 위한 보조 수단입니다.
        }
      }
      state.projects.status = "success";
      state.projects.filter = "all";
      renderFilters();
    } catch (error) {
      state.projects.status = "error";
      state.projects.repositories = [];
      state.projects.error = error.name === "AbortError"
        ? "요청 시간이 초과되었습니다. 네트워크 연결을 확인하고 다시 시도해 주세요."
        : error instanceof TypeError
          ? "네트워크에 연결할 수 없습니다. 연결을 확인한 뒤 다시 시도해 주세요."
          : error.message;
    } finally {
      window.clearTimeout(timeout);
      renderProjects();
    }
  };

  // 이벤트 위임: 동적으로 만든 필터/재시도 버튼에도 한 번만 이벤트를 연결합니다.
  dom.projectFilters.addEventListener("click", ({ target }) => {
    const button = target.closest("[data-language]");
    if (!button) return;
    state.projects.filter = button.dataset.language;
    dom.projectFilters.querySelectorAll("button").forEach((filterButton) => {
      const selected = filterButton === button;
      filterButton.classList.toggle("active", selected);
      filterButton.setAttribute("aria-pressed", String(selected));
    });
    renderProjects();
  });
  dom.projectStatus.addEventListener("click", ({ target }) => {
    if (target.closest('[data-action="retry"]')) loadProjects({ force: true });
  });

  // 7. 폼: 입력 → 유효성 상태 → 필드 근처 에러와 성공 메시지.
  const validateField = (field) => {
    const value = state.form.values[field].trim();
    const requiredMessages = { name: "이름을 입력해 주세요.", email: "이메일을 입력해 주세요.", message: "메시지를 입력해 주세요." };
    if (!value) return requiredMessages[field];
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "올바른 이메일 주소를 입력해 주세요.";
    return "";
  };

  const renderForm = () => {
    fields.forEach((field) => {
      const input = dom.form.elements.namedItem(field);
      const error = state.form.touched[field] || state.form.submitted ? state.form.errors[field] : "";
      document.querySelector(`#${field}-error`).textContent = error;
      input.classList.toggle("invalid", Boolean(error));
      input.setAttribute("aria-invalid", String(Boolean(error)));
    });
    dom.messageCount.textContent = `${state.form.values.message.length.toLocaleString("ko-KR")} / 2,000`;
    dom.formFeedback.hidden = !state.form.successful;
    dom.formFeedback.textContent = state.form.successful
      ? "입력 확인이 완료되었습니다! 체험용 폼이므로 메시지가 실제로 전송되지는 않습니다."
      : "";
  };

  dom.form.addEventListener("input", ({ target }) => {
    const { name, value } = target;
    if (!fields.includes(name)) return;
    state.form.values[name] = value;
    state.form.touched[name] = true;
    state.form.successful = false;
    state.form.errors[name] = validateField(name);
    renderForm();
  });

  dom.form.addEventListener("submit", (event) => {
    event.preventDefault();
    state.form.submitted = true;
    fields.forEach((field) => {
      // 브라우저 자동완성이 input 이벤트를 보내지 않는 경우도 반영합니다.
      state.form.values[field] = dom.form.elements.namedItem(field).value;
      state.form.errors[field] = validateField(field);
    });
    const firstInvalid = fields.find((field) => state.form.errors[field]);
    state.form.successful = !firstInvalid;
    renderForm();
    if (firstInvalid) dom.form.elements.namedItem(firstInvalid).focus();
  });

  renderTheme();
  renderMenu();
  renderForm();
  updateScroll();
  setupReveal();
  document.querySelector("#copyright-year").textContent = new Date().getFullYear();
  loadProjects();
})();
