document$.subscribe(({ body }) => {
    renderMathInElement(body, {
        delimiters: [
            { left: "$$",  right: "$$",  display: true },
            { left: "$",   right: "$",   display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true }
        ],
        macros: {
            "\\RR": "\\mathbb{R}", // Custom macro for real numbers
            "\\mycommand": "\\text{My Custom Command}", // Custom macro
        },
        throwOnError: false,
    })
})