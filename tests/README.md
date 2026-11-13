# Tests

Headless checks for the living-world pass. They are development tools; the game itself needs none of this.

    cd tests
    npm init -y && npm i playwright && npx playwright install chromium
    node lw1.js            # one suite per phase: lw1.js ... lw8.js (lw8 runs 15 game-minutes)
    node flow.js destroy 0 # full playthrough: <destroy|preserve|third> <god 0|1>
    node leak.js reload    # what survives a level reload; `node leak.js surv` for survival mode
    node perf2.js          # draw calls and triangles per level and quality tier

Set `JO_CHROME` to a Chromium binary to use a specific browser. Suites write screenshots next to themselves.
Frame rates measured this way use software rendering and say nothing about real hardware; use the F2 overlay in a normal browser.
