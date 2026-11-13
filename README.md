# Ink & Initiative

A pen-friendly D&D 5e character sheet for tablets, built as an installable offline web app.

**Open it:** https://kevinwcode.github.io/DNDStuff/

## Install on a Samsung tablet
1. Open the link above in Chrome or Samsung Internet.
2. Tap the menu (⋮ in Chrome, ☰ in Samsung Internet), then **Install app** or **Add to Home screen**.
3. Launch it from the home screen. After the first load it works offline.

Your characters are saved on the device only. Use **Menu → Copy** to back one up.

## Install as an Android app (APK)
The app is also built as a real Android app that runs fully offline, fonts included.

1. On the tablet, open https://github.com/KevinWCode/DNDStuff/releases/latest/download/ink-and-initiative.apk in Chrome or Samsung Internet. It downloads the newest build.
2. Open the downloaded file (from the notification or the **My Files → Downloads** folder).
3. If Android asks, tap **Settings** and turn on **Allow from this source** for your browser or My Files, then go back and tap **Install**.
4. If Play Protect warns about an unknown app, tap **More details → Install anyway**.

To update, download the latest APK the same way and install it over the old one; your characters stay.
Characters saved in the browser version don't move over by themselves: for each character, open **Menu → Backup → Copy** in the browser version, then in the app open **Menu → Backup**, paste into the box and tap **Import pasted backup**.

A new APK is built and published as a [release](https://github.com/KevinWCode/DNDStuff/releases) every time `main` changes (see `.github/workflows/android-apk.yml`).

## Features
- Import a public character from D&D Beyond (Menu → Import from D&D Beyond). Uses D&D Beyond's unofficial data feed, so it may break; a paste-the-data fallback is built in
- Game-HUD look: hex ability gems, an HP ring gauge with temp HP and a Bloodied mark, glowing action lanes and an End Turn plate
- One nav row for Combat, Sheet, Spells, Gear, Party, Notes and Log; it becomes a bottom tab bar in portrait
- Party screen with every character on the tablet and a local initiative tracker (live sync with the DM is next)
- Explore and Combat modes, with an action bar split into Action, Bonus Action, Reaction and Free
- HP keypad: damage, heal, temp HP, half; concentration saves, death saves, Bloodied badge
- Buff toggles (Bless, Rage, Hex, Cover, Haste, GWM, Sharpshooter) and weapon sets that update AC
- Long-press or S Pen hover on any number to see its math; double-tap to override it with a formula
- Flip-card spells, slot pips, resource counters with dawn recharge dice, per-class Hit Dice
- Companion and Wild Shape cards, attunement slots, undo and changelog
- S Pen notes with pressure, palm rejection and barrel-button eraser
- Eight themes from the Personal API style guide (Daylight, Dark, Glass, Ember Keep, Neon Grid, Awakened System, Gothic, Quest Board) plus five class themes
- 2014/2024 rules switch

Rules content is from the System Reference Document (SRD 5.1 / 5.2.1), CC-BY-4.0.

## Editing the code
The app source is split in `src/`. Rebuild the root files with:

```
node src/gen-themes.js   # only after changing theme colours
node src/build.js .
```

The Android wrapper uses [Capacitor](https://capacitorjs.com). To build it yourself you need Node 22, JDK 21 and the Android SDK:

```
npm ci
node scripts/apk-web.js        # bundles index.html + fonts into www/
npx cap sync android
cd android && ./gradlew assembleRelease
```

`scripts/android-icons.py` regenerates the launcher icons and splash screens from `icon-512.png`.
