window.MathJax = {
    tex: {
        packages: ["base", "ams", "color", "textmacros"], // Explicitly load extensions
        autoload: {
            color: [], // Enable color extension
            textmacros: [], // Enable textmacros extension
        },
        macros: {
            RR: "\\mathbb{R}", // Define custom macros
            bold: ["\\mathbf{#1}", 1],
        },
    },
    startup: {
        typeset: false, // Disable automatic typesetting (we'll handle it manually)
    },
};