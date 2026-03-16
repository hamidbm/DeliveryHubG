// ============================================================
// Tab active state
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
    const tabs = document.querySelectorAll(".md-tabs__item");
    tabs.forEach((tab) => {
        tab.addEventListener("click", function () {
            tabs.forEach((t) => t.classList.remove("active"));
            this.classList.add("active");
        });
    });
});

// ============================================================
// Collapse all folders in the navigation panel
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
    const collapseFolders = () => {
        const navItems = document.querySelectorAll(".md-nav__item--section");
        navItems.forEach((item) => {
            const toggle = item.querySelector(".md-nav__toggle");
            if (toggle) {
                toggle.checked = false;
            }
        });
    };
    collapseFolders();
    setTimeout(collapseFolders, 100);
});

// ============================================================
// Safari theme-color fix
//
// Problem: Safari paints the browser chrome (the strip above
// the page) using <meta name="theme-color">. The media-query
// variants in main.html only respond to the OS preference.
// When the user clicks the Material toggle button, only
// data-md-color-scheme on <body> changes — the OS preference
// stays the same, so Safari ignores the media variants.
//
// Fix: dynamically update a non-media theme-color meta tag
// whenever the scheme changes, using Material's own custom
// event system (document$ and location$) which survives
// instant navigation — unlike DOMContentLoaded which only
// fires once on the very first page load.
// ============================================================

function updateThemeColor() {
    const scheme = document.body.getAttribute("data-md-color-scheme");
    const color = scheme === "slate"
        ? "#f44336"   // dark mode  — Material "red" primary
        : "#0288d1";  // light mode — Material "light blue" primary

    // Target the non-media tag specifically so we don't
    // interfere with the media-query tags in main.html
    let meta = document.querySelector("meta[name='theme-color']:not([media])");
    if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
    }
    meta.content = color;
}

// Attach the MutationObserver — this must be re-attached
// after every instant navigation because Material replaces
// the body element, destroying any previous observer.
function attachSchemeObserver() {
    updateThemeColor(); // set correct color immediately on (re)attach

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === "data-md-color-scheme") {
                updateThemeColor();
            }
        });
    });
    observer.observe(document.body, { attributes: true });
}

// Material's instant navigation fires "document$" (an RxJS
// observable) on every page load including the first one.
// This is the correct hook — it survives instant navigation
// where DOMContentLoaded does not.
if (typeof document$ !== "undefined") {
    document$.subscribe(attachSchemeObserver);
} else {
    // Fallback: no instant navigation, plain DOMContentLoaded is fine
    document.addEventListener("DOMContentLoaded", attachSchemeObserver);
}