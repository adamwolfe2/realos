#!/usr/bin/env python3
"""Subset the site's web fonts. Run by hand; commit the output. See README.md.

Writes public/fonts/*.woff2, app/fonts.generated.css, app/fonts.generated.ts.
Fails loudly if scripts/fonts/usage.json shows a weight or OpenType feature
that the subsets do not keep.
"""
import hashlib, json, os, re, sys, unicodedata, urllib.request
from fontTools.ttLib import TTFont
from fontTools.subset import Options, Subsetter
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CACHE = os.path.join(HERE, ".cache")
OUT_DIR = os.path.join(ROOT, "public", "fonts")
USAGE = os.path.join(HERE, "usage.json")
# Per Google subset: its unicode-range and the code points its file really had.
COVERAGE = os.path.join(HERE, "google-coverage.json")

# Pinned upstream sources: the versions Google serves (Inter 4.001, JetBrains Mono 2.211).
# Neither OFL declares a Reserved Font Name, so the subsets keep their internal names.
GF = "https://raw.githubusercontent.com/google/fonts"
FONTS = [
    dict(
        family="Inter", slug="inter",
        url=f"{GF}/0b58fb370093f9a9f4ff785d94405710b79de67c/ofl/inter/Inter%5Bopsz,wght%5D.ttf",
        sha256="29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031",
        # wght 400 floor: nothing renders lighter. 900 ceiling: `bolder` on <strong>
        # inside 600/700 text resolves to 900. opsz stays 14-32: sizes run 8-150px.
        axes={"wght": (400, 900), "opsz": (14, 32)},
        # Browser defaults present in Inter, plus tabular-nums. Google's file also
        # had frac/numr/dnom/pnum; nothing turns them on.
        features=["calt", "ccmp", "locl", "kern", "mark", "mkmk", "tnum"],
        absent=["lnum"],  # requested by .ls-metric; Inter has none (figures are lining)
        fallback=dict(ascent="90.44%", descent="22.52%", line_gap="0.0%", size_adjust="107.12%"),
        var="--font-inter",
    ),
    dict(
        family="JetBrains Mono", slug="jetbrains-mono",
        url=f"{GF}/6e4b84c976cadb3c49a40fd9a1c203e4f7fcf2da/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
        sha256="48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda",
        # 800 is the font's own maximum; heavier requests already clamp there.
        axes={"wght": (400, 800)},
        features=["calt", "ccmp", "locl", "mark"],
        absent=["lnum", "tnum"],  # requested, but the font has neither (already tabular)
        fallback=dict(ascent="75.79%", descent="22.29%", line_gap="0.0%", size_adjust="134.59%"),
        var="--font-jetbrains",
    ),
]

# Chrome shapes each @font-face file as its own text run: a word split across
# two files loses kerning at the seam and the second part can move a sub-pixel.
# Chrome's small-size rasterization also depends on which characters a file
# maps. So the files reproduce Google's subsets one to one: core = latin,
# ext = latin-ext, and one file per other script (Cyrillic, Greek, Vietnamese),
# each downloading only when such text appears. Moving the core down to ASCII
# saves about 22 KB per page but changes how accented Latin text kerns.
PART = {"latin": "core", "latin-ext": "ext"}

# font-variant-* values (as collect-usage.mjs records them) -> features they turn on.
FEATURE_MAP = {
    "tabular-nums": ["tnum"], "lining-nums": ["lnum"], "oldstyle-nums": ["onum"],
    "proportional-nums": ["pnum"], "slashed-zero": ["zero"], "ordinal": ["ordn"],
    "diagonal-fractions": ["frac"], "stacked-fractions": ["afrc"],
    "discretionary-ligatures": ["dlig"], "historical-ligatures": ["hlig"],
    "small-caps": ["smcp"], "all-small-caps": ["smcp", "c2sc"], "petite-caps": ["pcap"],
    "all-petite-caps": ["pcap", "c2pc"], "unicase": ["unic"], "titling-caps": ["titl"],
}
# Values that keep defaults or only switch features off.
VARIANT_NOOPS = {"normal", "auto", "none", "common-ligatures", "contextual", "no-common-ligatures",
                 "no-discretionary-ligatures", "no-historical-ligatures", "no-contextual"}


def parse_ranges(s):
    out = set()
    for part in s.split(","):
        lo, _, hi = part.strip()[2:].partition("-")
        out.update(range(int(lo, 16), int(hi or lo, 16) + 1))
    return out


def fmt_ranges(cps):
    cps, out, i = sorted(cps), [], 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1:
            j += 1
        out.append(f"U+{cps[i]:X}" if i == j else f"U+{cps[i]:X}-{cps[j]:X}")
        i = j + 1
    return ",".join(out)


def fetch(font):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, font["slug"] + ".ttf")
    if not os.path.exists(path):
        urllib.request.urlretrieve(font["url"], path)
    digest = hashlib.sha256(open(path, "rb").read()).hexdigest()
    if digest != font["sha256"]:
        sys.exit(f"{path}: sha256 {digest} != pinned {font['sha256']}")
    return path


def check_usage(font, u, native_max):
    lo, hi = font["axes"]["wght"]
    # Above the font's own maximum the browser clamps today, so that is fine.
    bad = [w for w in map(float, u.get("weights", [])) if w < lo or (w > hi and hi < native_max)]
    if bad:
        sys.exit(f"{font['family']}: weights {bad} outside kept range {lo}-{hi}; widen axes")
    wanted = set()
    for f in u.get("features", []):
        wanted.update(re.findall(r'"(\w{4})"(?!\s*(?:0|off))', f))
    for v in u.get("variants", []):
        for t in filter(None, re.split(r"[|\s]+", v)):
            if t in FEATURE_MAP:
                wanted.update(FEATURE_MAP[t])
            elif t not in VARIANT_NOOPS:
                sys.exit(f"{font['family']}: unknown font-variant value {t!r}; map it in FEATURE_MAP")
    missing = wanted - set(font["features"]) - set(font["absent"])
    if missing:
        sys.exit(f"{font['family']}: features {missing} in use but not kept")
    if any(v != "normal" for v in u.get("variations", [])):
        sys.exit(f"{font['family']}: font-variation-settings in use {u['variations']}; review axes")


def partition(faces, cmap):
    """Which file each code point lives in, and which code points each file claims."""
    contents, claims, owner = {}, {}, {}
    for face in reversed(faces):  # later-declared faces win
        part = PART.get(face["subset"], face["subset"])
        has = parse_ranges(face["cmap"]) & cmap
        contents.setdefault(part, set()).update(has)
        for c in parse_ranges(face["unicode_range"]) & has:
            owner.setdefault(c, part)
    for c, part in owner.items():
        claims.setdefault(part, set()).add(c)
    return contents, claims, owner


def subset(src, unicodes, features, path, stamp):
    opts = Options()
    opts.flavor = "woff2"
    opts.layout_features = features
    opts.hinting = False
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG", "STAT"]
    opts.name_languages = [0x0409]
    # Keep post-table glyph names: without them Chrome rasterizes 11-18px text
    # differently from Google's files (~1 KB per file).
    opts.glyph_names = True
    s = Subsetter(opts)
    s.populate(unicodes=unicodes)
    # Pin the timestamp to the upstream file's, so reruns give byte-identical
    # files and unchanged names (fontTools would stamp the current time).
    f = TTFont(src, recalcTimestamp=False)
    f["head"].modified = stamp
    s.subset(f)
    f.flavor = "woff2"
    f.save(path)
    return set(TTFont(path).getBestCmap())


def main():
    pages = [p["usage"] for p in json.load(open(USAGE)).values() if "usage" in p]
    coverage = json.load(open(COVERAGE))["families"]
    os.makedirs(OUT_DIR, exist_ok=True)
    for f in os.listdir(OUT_DIR):
        if f.endswith(".woff2"):
            os.remove(os.path.join(OUT_DIR, f))
    css, preloads, report = [], [], []
    for font in FONTS:
        u = {}
        for p in pages:
            for k, v in p.get(font["family"], {}).items():
                u.setdefault(k, set()).update(v)
        full = TTFont(fetch(font))
        check_usage(font, u, next(a.maxValue for a in full["fvar"].axes if a.axisTag == "wght"))
        contents, claims, owner = partition(coverage[font["family"]], set(full.getBestCmap()))
        fallback = sorted(c for c in u.get("chars", []) if c > 0x7E and c not in owner
                          and unicodedata.category(chr(c))[0] != "C")
        if fallback:
            print(f"  {font['family']}: used, drawn by the fallback stack as before: "
                  + " ".join(chr(c) for c in fallback))

        # Limit axes once (also works around fontTools choking on raw upstream gvar).
        lim_path = os.path.join(CACHE, font["slug"] + ".limited.ttf")
        instantiateVariableFont(full, font["axes"], inplace=False).save(lim_path)
        lo, hi = font["axes"]["wght"]
        for part in contents:
            if not claims.get(part):
                continue  # every character is drawn by a later-declared subset
            tmp = os.path.join(OUT_DIR, f"{font['slug']}-{part}.woff2")
            got = subset(lim_path, contents[part], font["features"], tmp, full["head"].modified)
            if got != contents[part] or not claims[part] <= got:
                sys.exit(f"{tmp}: cmap does not match the expected code points")
            name = f"{font['slug']}-{part}.{hashlib.sha256(open(tmp, 'rb').read()).hexdigest()[:10]}.woff2"
            os.rename(tmp, os.path.join(OUT_DIR, name))
            url = f"/fonts/{name}"
            if part == "core":
                preloads.append(url)
            report.append(f"{name}\t{os.path.getsize(os.path.join(OUT_DIR, name))} bytes\t"
                          f"{len(got)} glyph-mapped chars, {len(claims[part])} claimed")
            css.append(
                f'@font-face {{ font-family: "{font["family"]}"; font-style: normal; font-weight: {lo} {hi}; '
                f'font-display: swap; src: url("{url}") format("woff2"); unicode-range: {fmt_ranges(claims[part])}; }}'
            )
        fb = font["fallback"]
        css.append(
            f'@font-face {{ font-family: "{font["family"]} Fallback"; src: local("Arial"); '
            f'ascent-override: {fb["ascent"]}; descent-override: {fb["descent"]}; '
            f'line-gap-override: {fb["line_gap"]}; size-adjust: {fb["size_adjust"]}; }}'
        )
        css.append(f':root {{ {font["var"]}: "{font["family"]}", "{font["family"]} Fallback"; }}')

    # Core, ext and rest share one family name, so the fallback face comes after
    # all three and never draws a character that ext or rest has.
    header = "/* GENERATED by scripts/fonts/subset-fonts.py. Do not edit; rerun the script. */\n"
    open(os.path.join(ROOT, "app", "fonts.generated.css"), "w").write(header + "\n".join(css) + "\n")
    open(os.path.join(ROOT, "app", "fonts.generated.ts"), "w").write(
        "// GENERATED by scripts/fonts/subset-fonts.py. Do not edit; rerun the script.\n"
        f"export const FONT_PRELOADS = {json.dumps(preloads, indent=2)} as const;\n"
    )
    print("\n".join(report))


if __name__ == "__main__":
    main()
