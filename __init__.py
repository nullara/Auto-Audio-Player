import os
import uuid
import wave
import tempfile
from pathlib import Path

import numpy as np
import torch
from aiohttp import web
from server import PromptServer

WEB_DIRECTORY = "./js"

TEMP_SUBDIR = "auto_audio_player"

LATEST_AUDIO_STATE = {
    "revision": 0,
    "filename": None,
    "url": None,
    "sample_rate": None,
    "channels": None,
    "duration": None,
    "autoplay": True,
    "default_volume": 1.0,
    "loop": False,
}


def _get_temp_root() -> Path:
    base = Path(tempfile.gettempdir()) / "ComfyUI" / TEMP_SUBDIR
    base.mkdir(parents=True, exist_ok=True)
    return base


def _to_numpy_audio(audio):
    if not isinstance(audio, dict):
        raise TypeError("Expected ComfyUI AUDIO input as a dict with waveform and sample_rate.")

    waveform = audio.get("waveform")
    sample_rate = int(audio.get("sample_rate", 44100))

    if waveform is None:
        raise ValueError("Audio input is missing 'waveform'.")

    if isinstance(waveform, torch.Tensor):
        data = waveform.detach().cpu().float().numpy()
    else:
        data = np.asarray(waveform, dtype=np.float32)

    if data.ndim == 3:
        data = data[0]
    if data.ndim == 1:
        data = data[np.newaxis, :]
    elif data.ndim == 2:
        if data.shape[0] > data.shape[1] and data.shape[1] <= 8:
            data = data.T
    else:
        raise ValueError(f"Unsupported waveform shape: {data.shape}")

    data = np.clip(data, -1.0, 1.0)
    return data, sample_rate


def _write_wav(audio_path: Path, waveform: np.ndarray, sample_rate: int):
    pcm = (waveform * 32767.0).astype(np.int16)
    pcm_interleaved = pcm.T

    with wave.open(str(audio_path), "wb") as wav_file:
        wav_file.setnchannels(pcm.shape[0])
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_interleaved.tobytes())


@PromptServer.instance.routes.get("/auto_audio_player/{filename}")
async def serve_auto_audio_player_file(request):
    filename = request.match_info["filename"]
    safe_name = os.path.basename(filename)
    path = _get_temp_root() / safe_name

    if not path.exists() or not path.is_file():
        return web.Response(status=404, text="Audio file not found.")

    return web.FileResponse(path, headers={"Cache-Control": "no-store"})


@PromptServer.instance.routes.get("/auto_audio_player/latest")
async def get_latest_auto_audio_player_state(request):
    return web.json_response(LATEST_AUDIO_STATE, headers={"Cache-Control": "no-store"})


class AutoAudioPlayer:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "audio": ("AUDIO",),
                "autoplay": ("BOOLEAN", {"default": True}),
                "default_volume": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "loop": ("BOOLEAN", {"default": False}),
            }
        }

    RETURN_TYPES = ("AUDIO",)
    RETURN_NAMES = ("audio",)
    FUNCTION = "process"
    CATEGORY = "audio/utils"
    OUTPUT_NODE = True

    def process(self, audio, autoplay=True, default_volume=1.0, loop=False):
        global LATEST_AUDIO_STATE

        waveform, sample_rate = _to_numpy_audio(audio)
        filename = f"auto_audio_{uuid.uuid4().hex}.wav"
        out_path = _get_temp_root() / filename
        _write_wav(out_path, waveform, sample_rate)

        duration = float(waveform.shape[1]) / float(sample_rate) if sample_rate > 0 else 0.0

        ui_payload = {
            "filename": filename,
            "url": f"/auto_audio_player/{filename}",
            "sample_rate": sample_rate,
            "channels": int(waveform.shape[0]),
            "duration": duration,
            "autoplay": bool(autoplay),
            "default_volume": float(default_volume),
            "loop": bool(loop),
        }

        LATEST_AUDIO_STATE = {
            "revision": int(LATEST_AUDIO_STATE.get("revision", 0)) + 1,
            **ui_payload,
        }

        return {"ui": {"audio": [ui_payload]}, "result": (audio,)}


NODE_CLASS_MAPPINGS = {
    "AutoAudioPlayer": AutoAudioPlayer,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AutoAudioPlayer": "Auto Audio Player",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]