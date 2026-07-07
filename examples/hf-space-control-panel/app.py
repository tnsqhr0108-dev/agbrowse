import os
import subprocess

import gradio as gr


TOKEN = os.environ.get("AGBROWSE_PANEL_TOKEN", "")


def _authorized(token: str) -> bool:
    return not TOKEN or token == TOKEN


def run_agbrowse(token: str, args: list[str]) -> str:
    if not _authorized(token):
        return "Unauthorized: set the correct AGBROWSE_PANEL_TOKEN."

    proc = subprocess.run(
        ["agbrowse", *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=60,
        check=False,
    )
    return proc.stdout[-8000:] or f"exit code {proc.returncode}"


def status(token: str) -> str:
    return run_agbrowse(token, ["status", "--json"])


def start_headless(token: str) -> str:
    return run_agbrowse(token, ["start", "--headless", "--port", "9223"])


def example_snapshot(token: str) -> str:
    if not _authorized(token):
        return "Unauthorized: set the correct AGBROWSE_PANEL_TOKEN."
    nav = run_agbrowse(token, ["navigate", "https://example.com"])
    snap = run_agbrowse(token, ["snapshot", "--interactive", "--max-nodes", "40"])
    return f"{nav}\n\n{snap}"


with gr.Blocks(title="AGBROWSE Control Panel") as demo:
    gr.Markdown(
        """
        # AGBROWSE Control Panel

        Minimal Hugging Face Space helper for status and headless smoke checks.
        Do not expose logged-in provider browser profiles on a public Space.
        """
    )
    token = gr.Textbox(label="Panel token", type="password")
    output = gr.Textbox(label="Output", lines=18)
    with gr.Row():
        gr.Button("Status").click(status, inputs=token, outputs=output)
        gr.Button("Start Headless").click(start_headless, inputs=token, outputs=output)
        gr.Button("Example Snapshot").click(example_snapshot, inputs=token, outputs=output)


if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
