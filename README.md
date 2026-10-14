# NVIDIA Reverse Proxy for Render

Minimal ESM reverse proxy that forwards requests to `integrate.api.nvidia.com`.

## Deploy on Render

1. Push this repo to GitHub
2. Render Dashboard -> New + -> Web Service
3. Connect repo
4. Settings:
   - Runtime: Node
   - Build Command: npm install
   - Start Command: node index.mjs
   - Region: Frankfurt (or any EU)
5. Environment: PROXY_SECRET=<random string>

## Use in DSH

In ~/.dsh/profiles/web/cordis.patch.yml add baseURL:

    - id: llm-pi-ai
      config:
        providers:
          nvidia:
            apiKeyEnv: NVIDIA_API_KEY
            baseURL: https://your-proxy.onrender.com/v1?secret=<PROXY_SECRET>
