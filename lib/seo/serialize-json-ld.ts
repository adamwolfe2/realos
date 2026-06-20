// ---------------------------------------------------------------------------
// Safe JSON-LD serialization.
//
// JSON.stringify(...) injected raw into <script type="application/ld+json">
// is a stored-XSS vector: a `</script>` sequence inside any operator- or
// AI-authored field (title, intro, FAQ text) breaks out of the script block
// and runs arbitrary JS on the public tenant site. `<`, `>`, `&` are all valid
// JSON when written as their \u00XX escapes — crawlers decode them identically,
// but the HTML parser can no longer see a closing tag. We also escape the
// U+2028 / U+2029 line separators, which are valid in JSON strings but break
// inline <script> parsing in some engines.
// ---------------------------------------------------------------------------

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// For embedding the safe JSON-LD inside a GENERATED MDX/JSX template literal
// (see lib/content/render-mdx.ts — the script tag is compiled as JSX, so its
// `__html` backtick body is evaluated at render time). Without this, the
// evaluation would un-escape `<` back to `<` and re-open the breakout.
// We escape exactly the three sequences special to a template literal —
// backslash, backtick, and `${` — so the literal evaluates back to EXACTLY the
// serializeJsonLd output (HTML-safe escapes intact).
export function serializeJsonLdForTemplateLiteral(value: unknown): string {
  return serializeJsonLd(value)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}
