document.addEventListener("DOMContentLoaded", function () {
    // Render MathJax equations on initial page load
    if (window.MathJax) {
        MathJax.typeset();
    }

    // Re-render MathJax equations when navigating to a new page
    document.addEventListener("mkdocs-page-ready", function () {
        if (window.MathJax) {
            // Clear MathJax's previous typeset results
            MathJax.typesetClear();
            // Re-render equations
            MathJax.typeset();
        }
    });
});