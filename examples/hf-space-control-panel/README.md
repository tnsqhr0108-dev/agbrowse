# AGBROWSE Hugging Face Space Control Panel

This is a minimal Gradio control panel for experiments on Hugging Face Spaces.
It is not a secure hosted browser service and should not be used to expose a
logged-in ChatGPT, Gemini, or Grok browser profile to the public internet.

## Files

- `Dockerfile` installs Node.js dependencies and links the local package.
- `app.py` exposes status and a headless start button.
- `requirements.txt` installs Gradio.

## Deploy Notes

1. Create a Docker Space.
2. Copy this folder's files to the Space root together with the AGBROWSE package
   source, or adapt the Dockerfile to install `agbrowse` from npm.
3. Set `AGBROWSE_PANEL_TOKEN` in Space secrets if the Space is public.
4. Open the Space and run read-only status checks first.

Free CPU Spaces can sleep and restart, and their default disk is not
persistent. Treat this as a demo/control panel, not as a private always-on VPS.
