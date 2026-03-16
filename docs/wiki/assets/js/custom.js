document.addEventListener("DOMContentLoaded", function () {
    const tabs = document.querySelectorAll(".md-tabs__item");
    tabs.forEach((tab) => {
        tab.addEventListener("click", function () {
            tabs.forEach((t) => t.classList.remove("active"));
            this.classList.add("active");
        });
    });
});

document.addEventListener("DOMContentLoaded", function () {
    // Collapse all folders in the navigation panel
    const collapseFolders = () => {
        const navItems = document.querySelectorAll(".md-nav__item--section");
        navItems.forEach((item) => {
            const toggle = item.querySelector(".md-nav__toggle");
            if (toggle) {
                toggle.checked = false; // Collapse the folder
            }
        });
    };

    // Run the function immediately
    collapseFolders();

    // Re-run the function after a short delay to ensure it works
    setTimeout(collapseFolders, 100);
});