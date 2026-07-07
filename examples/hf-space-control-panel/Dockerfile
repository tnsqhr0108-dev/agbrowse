FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

COPY . /app

RUN npm install && npm link
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r examples/hf-space-control-panel/requirements.txt

ENV CHROME_BINARY_PATH=/usr/bin/chromium
ENV CHROME_HEADLESS=1
ENV CHROME_NO_SANDBOX=1
ENV CDP_PORT=9223
ENV AGBROWSE_JSON_ERRORS=1

EXPOSE 7860

CMD ["python", "examples/hf-space-control-panel/app.py"]
