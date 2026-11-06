# Cloudy Shorts media processor

A private container service for trusted extraction of frames and audio from the original Cloudy Shorts object. It runs FFmpeg outside the Cloudflare Worker request runtime.

## Runtime configuration

Set these environment variables on the container host:

- \`CLOUDY_MEDIA_PROCESSOR_TOKEN\`: a long random bearer token shared with the Cloudy application server. Never expose it to browsers or commit it.
- \`CLOUDY_CONTENT_SUPABASE_URL\`: base URL of the separate Cloudy Content Supabase project (not the Core project).
- \`PORT\`: optional, defaults to \`8787\`.

The service does not need the Content service-role key. The Cloudy application server creates a five-minute signed URL for the exact private video and sends it over HTTPS.

## API

- \`GET /health\`: readiness only; never returns configuration values.
- \`POST /v1/extract\`: authenticated server-to-server request:
  \`{"videoId":"<uuid>","mode":"frames|audio","sourceUrl":"<five-minute-signed-private-storage-url>"}\`

The service validates the URL origin, private bucket path, video UUID, signed token, duration, file size and output size. It rejects redirects, limits concurrency, uses a temporary directory and deletes temporary files after each request.

Frame mode returns up to six low-resolution JPEG data URLs. Audio mode returns mono 16 kHz WAV chunks of at most 20 seconds each (maximum nine chunks). The raw original and temporary extracts are never persisted by this service.

## Build and run

\`\`\`sh
docker build -t cloudy-shorts-media .
docker run --rm -p 8787:8787 \
  -e CLOUDY_MEDIA_PROCESSOR_TOKEN="$CLOUDY_MEDIA_PROCESSOR_TOKEN" \
  -e SUPABASE_URL="$SUPABASE_URL" \
  cloudy-shorts-media
\`\`\`

Deploy this container on a private HTTPS-capable container host. Configure \`CLOUDY_MEDIA_PROCESSOR_URL\` and \`CLOUDY_MEDIA_PROCESSOR_TOKEN\` only in the Cloudy server environment. Do not publish the service token in client configuration.
