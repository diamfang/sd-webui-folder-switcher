from fastapi import FastAPI, Body
import os
import gradio as gr
from modules import script_callbacks, shared

def get_base_dir():
    base_path = os.path.abspath(os.getcwd())
    return {"base_path": base_path}

def set_output_dir(data: dict = Body(...)):
    base_folder = data.get("folder_path", "").strip()
    
    if not base_folder:
        base_folder = "outputs"

    base = os.path.normpath(base_folder)

    paths_map = {
        'outdir_dir': base,
        'outdir_samples': '',
        'outdir_txt2img_samples': os.path.join(base, "txt2img-images"),
        'outdir_img2img_samples': os.path.join(base, "img2img-images"),
        'outdir_extras_samples': os.path.join(base, "extras-images"),
        'outdir_txt2img_grids': os.path.join(base, "txt2img-grids"),
        'outdir_img2img_grids': os.path.join(base, "img2img-grids"),
        'outdir_videos': os.path.join(base, "videos"),
        'outdir_init_images': os.path.join(base, "init-images"),
    }

    for key, path_val in paths_map.items():
        shared.opts.data[key] = path_val

    try:
        config_file = getattr(shared, 'config_filename', 'config.json')
        if hasattr(shared.opts, 'save'):
            shared.opts.save(config_file)
        elif hasattr(shared.opts, 'save_to_file'):
            shared.opts.save_to_file()
    except Exception:
        pass

    return {
        "status": "success",
        "updated_paths": {k: shared.opts.data.get(k) for k in paths_map.keys()}
    }

def on_app_started(demo: gr.Blocks, app: FastAPI):
    app.add_api_route("/sdapi/v1/folder-switcher/get-base-dir", get_base_dir, methods=["GET"])
    app.add_api_route("/sdapi/v1/folder-switcher/set-dir", set_output_dir, methods=["POST"])

script_callbacks.on_app_started(on_app_started)