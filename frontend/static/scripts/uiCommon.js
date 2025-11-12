// Archivo: static/scripts/uiCommon.js
// Gestiona interacciones comunes de la interfaz (sidebar y tema) para las vistas principales.

(function () {
    const themeStorageKey = 'tombers.theme';

    const resolveInitialTheme = () => {
        try {
            const stored = localStorage.getItem(themeStorageKey);
            if (stored === 'dark' || stored === 'light') {
                return { theme: stored, fromStorage: true };
            }
        } catch {
            // almacenamiento inaccesible (modo incognito, etc.)
        }
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return { theme: prefersDark ? 'dark' : 'light', fromStorage: false };
    };

    document.addEventListener('DOMContentLoaded', () => {
        const sidebar = document.getElementById('sidebar');
        const sidebarTrigger = document.getElementById('sidebar-trigger');
        const desktopThemeToggle = document.getElementById('theme-toggle');
        const mobileThemeToggle = document.getElementById('theme-togglemo');

        let sidebarHideTimeout = null;

        const syncThemeToggles = (isDark) => {
            if (desktopThemeToggle) {
                desktopThemeToggle.checked = isDark;
            }
            if (mobileThemeToggle) {
                mobileThemeToggle.checked = isDark;
            }
        };

        const applyTheme = (theme, persist = true) => {
            const isDark = theme === 'dark';
            document.body.classList.toggle('dark-mode', isDark);
            syncThemeToggles(isDark);
            if (!persist) {
                return;
            }
            try {
                localStorage.setItem(themeStorageKey, theme);
            } catch {
                // ignorar errores de almacenamiento (p. ej. modo incognito)
            }
        };

        const { theme: initialTheme, fromStorage } = resolveInitialTheme();
        applyTheme(initialTheme, fromStorage);

        const themeChangeHandler = (event) => {
            const theme = event.target.checked ? 'dark' : 'light';
            applyTheme(theme, true);
        };

        desktopThemeToggle?.addEventListener('change', themeChangeHandler);
        mobileThemeToggle?.addEventListener('change', themeChangeHandler);

        if (window.matchMedia) {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
            const systemThemeListener = (event) => {
                try {
                    const stored = localStorage.getItem(themeStorageKey);
                    if (stored === 'dark' || stored === 'light') {
                        return;
                    }
                } catch {
                    // ignorar errores de almacenamiento
                }
                applyTheme(event.matches ? 'dark' : 'light', false);
            };
            if (typeof systemTheme.addEventListener === 'function') {
                systemTheme.addEventListener('change', systemThemeListener);
            } else if (typeof systemTheme.addListener === 'function') {
                systemTheme.addListener(systemThemeListener);
            }
        }

        const activateSidebar = () => {
            if (!sidebar) return;
            clearTimeout(sidebarHideTimeout);
            sidebar.classList.add('active');
        };

        const scheduleHideSidebar = () => {
            if (!sidebar) return;
            clearTimeout(sidebarHideTimeout);
            sidebarHideTimeout = setTimeout(() => {
                sidebar.classList.remove('active');
            }, 150);
        };

        const toggleSidebarVisibility = () => {
            if (!sidebar) return;
            const willShow = !sidebar.classList.contains('active');
            if (willShow) {
                activateSidebar();
            } else {
                sidebar.classList.remove('active');
            }
        };

        sidebarTrigger?.addEventListener('mouseenter', activateSidebar);
        sidebarTrigger?.addEventListener('mouseleave', scheduleHideSidebar);
        sidebar?.addEventListener('mouseenter', activateSidebar);
        sidebar?.addEventListener('mouseleave', scheduleHideSidebar);
        sidebarTrigger?.addEventListener('click', toggleSidebarVisibility);

        sidebarTrigger?.addEventListener(
            'touchstart',
            (event) => {
                event.preventDefault();
                toggleSidebarVisibility();
            },
            { passive: false },
        );

        document.addEventListener(
            'touchstart',
            (event) => {
                if (!sidebar) return;
                if (sidebar.contains(event.target) || sidebarTrigger?.contains(event.target)) {
                    return;
                }
                sidebar.classList.remove('active');
            },
            { passive: true },
        );

        // Hero banner collapse/expand handling (shared across views)
        const setupHeroToggles = () => {
            const heroes = document.querySelectorAll('.hero-block.collapsible');
            heroes.forEach((hero) => {
                let btn = hero.querySelector('.hero-toggle');
                if (!btn) {
                    btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'hero-toggle';
                    btn.title = 'Expandir/Minimizar';
                    btn.setAttribute('aria-label', 'Expandir o minimizar');
                    btn.textContent = '▾';
                    hero.appendChild(btn);
                }
                const updateIcon = () => {
                    const collapsed = hero.classList.contains('collapsed');
                    btn.textContent = collapsed ? '▾' : '▴';
                };
                btn.addEventListener('click', () => {
                    hero.classList.toggle('collapsed');
                    updateIcon();
                    scheduleAdjust();
                });
                updateIcon();
            });
        };

        // Calcula el desplazamiento necesario para que el banner no tape la tarjeta
        const adjustHeroCardOffset = () => {
            const layout = document.querySelector('.my-projects-layout');
            const hero = layout?.querySelector('.hero-block.collapsible');
            const card = layout?.querySelector('.card-container');
            if (!layout || !card) {
                return;
            }
            // offset base
            let offsetPx = 10;
            const bannerVisible = hero && window.getComputedStyle(hero).display !== 'none' && !document.body.classList.contains('hide-hero');
            if (bannerVisible) {
                const heroRect = hero.getBoundingClientRect();
                const cardRect = card.getBoundingClientRect();
                const requiredTop = Math.ceil(heroRect.bottom + 12); // 12px de aire
                const currentTop = Math.ceil(cardRect.top);
                const extra = Math.max(0, requiredTop - currentTop);
                offsetPx = 10 + extra;
            }
            layout.style.setProperty('--hero-card-offset', `${offsetPx}px`);
        };

        let adjustScheduled = false;
        const scheduleAdjust = () => {
            if (adjustScheduled) return;
            adjustScheduled = true;
            requestAnimationFrame(() => {
                adjustScheduled = false;
                adjustHeroCardOffset();
            });
        };

        setupHeroToggles();
        scheduleAdjust();
        window.addEventListener('resize', scheduleAdjust);
        document.addEventListener('scroll', scheduleAdjust, { passive: true });
    });
})();
