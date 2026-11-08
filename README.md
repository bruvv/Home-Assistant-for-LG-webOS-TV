# Home Assistant for LG webOS TV (v1.1.0)

Unofficial fullscreen Home Assistant launcher for rooted LG webOS TVs. Interface and instructions are in English. The Home Assistant URL stays on the TV, and authentication happens directly with your Home Assistant server.

## 1. Update the TV app

1. Open your TV's Glasshouse web dashboard on your computer.
2. In **Apps**, use **Install from a file** and select `nl.local.homeassistanttv_1.1.0_all.ipk`.
3. Launch **Home Assistant**. Your saved URL should survive the upgrade because the package ID and localStorage key are unchanged. If it doesn't, enter the URL again.

The launcher deliberately opens Home Assistant as a **top-level page**, not an iframe, so iframe/security restrictions do not interfere with sign-in. This means the launcher itself cannot add scrolling fixes once it has navigated to Home Assistant.

## 2. Fix scrolling inside Home Assistant

The included `home-assistant/ha-tv-scroll.js` must be loaded **by Home Assistant**, not by the IPK. This step is necessary because the Home Assistant page has its own JavaScript context after navigation.

1. Copy `home-assistant/ha-tv-scroll.js` to your Home Assistant config directory as `/config/www/ha-tv-scroll.js` (create `www` if needed).
2. Add the following to your Home Assistant `/config/configuration.yaml`. **If you already have a `frontend:` section, merge the entry under that existing section instead of adding a second one. Preserve any other extra modules.**

```yaml
frontend:
  extra_module_url:
    - /local/ha-tv-scroll.js?v=110
```

3. Validate the Home Assistant configuration and restart Home Assistant. If you have just created the `www` directory, a restart also makes it available under `/local/`.
4. Reopen the TV app and Home Assistant. On **LG webOS only**, the scroll helper listens for Magic Remote wheel scrolling and adds subtle **Up** and **Down** buttons at the bottom right as a fallback.

The script also supports Page Up / Page Down and Arrow Up / Arrow Down where the focused element is not an interactive control. It searches through open Shadow DOM roots to find the active scrolling panel. The helper does nothing on regular desktop/mobile browser user agents. It deliberately does not intercept wheel interactions with maps or sliders.

**Troubleshooting:** Open `http://YOUR_HA:8123/local/ha-tv-scroll.js?v=110` in a browser and verify that the JavaScript loads. The helper should log `[Home Assistant TV scroll] Ready for LG webOS` in TV DevTools. If the helper is not loaded, the IPK alone cannot change Home Assistant's scrolling.

**Important:** Home Assistant's `www` directory is public to anyone who can access the HA server. The supplied script contains no secrets, credentials, or tokens.

## 3. Change Home Assistant's language to English

In Home Assistant, open your user profile and set **Language** to **English**. That changes the Home Assistant UI. The launcher and scroll-helper buttons are already in English. This is an account-level UI preference, not something an external launcher should override.

## 4. GPU acceleration

The TV's built-in Chromium/webOS renderer manages hardware compositing. A webOS IPK cannot force GPU acceleration on a remote website with a supported app manifest option. This build avoids extra rendering layers and animations; it does not claim faster GPU rendering. The optional helper modifies only input/scroll behavior.

## Downloads and releases

Download the IPK and optional `ha-tv-scroll.js` from the
[latest release](https://github.com/bruvv/Home-Assistant-for-LG-webOS-TV/releases/latest).
See [CHANGELOG.md](CHANGELOG.md) for release notes.

GitHub Actions builds and checks the package on pushes to `main` and pull
requests. Each run uploads the IPK as a workflow artifact. A successful build
on `main` automatically publishes a release if the version has not been
released yet; manual workflow runs on `main` can retry a failed release.

To release a new version:

1. Bump `version` in `app/appinfo.json` (numeric `major.minor.patch`).
2. Add a matching `## [major.minor.patch] - YYYY-MM-DD` entry to `CHANGELOG.md`
   and update versioned filenames in this README.
3. Push to `main`. The workflow creates the `vmajor.minor.patch` tag and release
   with that changelog entry, the IPK, and the scrolling helper. Existing
   releases are left unchanged.

## Rebuild on macOS

Only Python 3 is required; the build script uses the standard library:

```sh
cd homeassistant-webos-src
python3 build.py
```

This produces `nl.local.homeassistanttv_1.1.0_all.ipk`. You can alternatively use LG's official `ares-package app` tooling.

## Technical limitations

- Installing the IPK alone translates the launcher but **does not fix Home Assistant scrolling**. Enable the Home Assistant-side helper as described.
- Some custom cards have their own private/closed Shadow DOM scroll areas. These may not be accessible to the helper; the fallback buttons might not work in those views.
- If the Magic Remote does not dispatch wheel events to the Chromium web app, use the Up/Down overlay. No client-only JavaScript can synthesize events that the TV never sends.
- This package has been syntax/structure checked and tested against a mock scrolling page, **not on the user's physical LG G6**.
- The login/session handling remains Home Assistant's own; no passwords or access tokens are bundled into the IPK.

### References

- LG Magic Remote events: https://webostv.developer.lge.com/develop/guides/magic-remote
- LG web engine specifications: https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine
- Home Assistant frontend extra modules: https://www.home-assistant.io/integrations/frontend/#loading-extra-javascript
- Home Assistant `/local/` resources: https://developers.home-assistant.io/docs/frontend/custom-ui/registering-resources/
