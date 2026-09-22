# Contributing

There's no build step and nothing to install. Edit a file, refresh the page.

    python3 -m http.server 8765

then open http://localhost:8765.

A few house rules, in the spirit of the place:

**The film is the reference.** Names, times, lines, what breaks and in which order. If you're adding something from the novel rather than the movie, say so in the pull request. Both are welcome, they're just different canons.

**Nothing from the film goes in the repo.** No screenshots, no audio clips, no fonts ripped from a DVD. Everything you see is drawn in SVG or canvas, everything you hear comes out of `js/audio.js`. This is what lets the project exist in public. Please keep it that way.

**No dependencies.** Plain JavaScript, plain script tags, works from any static server. If your feature needs a library, it probably needs a rethink.

**Easter eggs are encouraged.** Add a command to `cmds` in `js/shell.js` and put its name in `hiddenCmds` so it stays out of tab completion. One line from the movie is enough. Make it good.

**Test both endings before you open a PR.** The shed route (`shutdown`, breakers, reboot, `fsn` door locks, `fences reset`) and the back door. `timescale 12` and `scenario skip` make the whole thing take about a minute.

If something's broken, open an issue with the browser you're using and whatever the console says. Hold onto your butts.

Commits in this repository are signed. Yours don't have to be.
