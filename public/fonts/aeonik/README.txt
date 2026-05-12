Aeonik web font files
=====================

Drop the licensed Aeonik .woff2 files into this directory using these exact
names so the @font-face declarations in src/app/globals.css can find them:

    Aeonik-Regular.woff2   (weight 400)
    Aeonik-Medium.woff2    (weight 500, also serves 600)
    Aeonik-Bold.woff2      (weight 700)

Until those files are dropped in, the page renders with Inter (loaded via
next/font/google) as the fallback — visually close enough that nothing looks
broken, but the brand typeface won't be active.

Aeonik is a proprietary typeface from CoType Foundry; do not commit the
.woff2 files unless your license permits embedding them in this repository.
