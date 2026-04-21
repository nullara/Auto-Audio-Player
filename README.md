# ComfyUI Auto Audio Player

A lightweight ComfyUI custom node that automatically plays audio when a new `AUDIO` input reaches the node.

## Features

- Auto-play when fresh audio reaches the node
- Play / Pause control
- Seek bar for scrubbing through the clip
- Volume control
- Loop toggle
- Autoplay toggle
- Passes the original `AUDIO` through unchanged for downstream nodes

## Node

- **Name:** `Auto Audio Player`
- **Category:** `audio/utils`

## Inputs

- `audio` (`AUDIO`)
- `autoplay` (`BOOLEAN`, default `true`)
- `default_volume` (`FLOAT`, default `1.0`)
- `loop` (`BOOLEAN`, default `false`)

## Output

- `audio` (`AUDIO`) passthrough

## Install

1. Clone or download this repository.
2. Place the folder in your ComfyUI `custom_nodes` directory.
3. Restart ComfyUI.
4. Add **Auto Audio Player** from `audio/utils`.
5. Connect any `AUDIO` output into it.

Example:

```text
Audio Source -> Auto Audio Player -> Any downstream AUDIO node
```

## Notes

- The node writes a temporary WAV file so the frontend can load and play it.
- Some browsers block autoplay until the page has received user interaction. In that case, the node still loads the clip and the Play button works normally.
- The custom UI hides the duplicate built-in control widgets and keeps playback controls in a single panel.
- Frontend code uses ComfyUI's extension registration pattern with `WEB_DIRECTORY = "./js"` and a frontend script loaded from `js/auto_audio_player.js`.

## Files

```text
ComfyUI-AutoAudioPlayer/
├── __init__.py
├── LICENSE
├── README.md
├── .gitignore
└── js/
    └── auto_audio_player.js
```

## License

MIT
