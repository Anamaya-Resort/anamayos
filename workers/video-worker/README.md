# anamayos-video-worker

Railway-deployed Node worker for the AnamayOS Video Maker module.

Handles all heavy/background jobs:

- Google Drive crawling + inventory
- Proxy + thumbnail generation (FFmpeg, sharp)
- AI analysis (vision tagging, transcription, embedding)
- Final video rendering (FFmpeg filtergraph)
- Cache cleanup

The Next.js app **only enqueues** jobs into pg-boss; it never runs FFmpeg or
makes the heavy AI calls inline. Keep that boundary clean.

## Layout

```
src/
  index.ts          # bootstrap: pg-boss, register handlers, start workers
  queue.ts          # pg-boss factory
  log.ts            # pino logger
  jobs/             # one file per job kind (added slice by slice)
```

## Railway setup (one time)

1. Create a new Railway project (or service in an existing project).
2. Connect this repo; set the service **root directory** to `workers/video-worker`.
3. Add environment variables from `.env.example`.
4. Deploy. Railway will use `nixpacks.toml` to install Node 20 + FFmpeg + libvips.
5. Verify in Railway logs that the worker prints `video-worker online`.

## Local dev

```bash
cd workers/video-worker
cp .env.example .env   # fill in real values
npm install
npm run dev
```

## Jobs registered

Slice 0: none — bootstrap only. Each subsequent slice adds its handlers under `src/jobs/`.
