# Worker scripts

## Model bakeoff

Answers "which model should tag our library" against Anamaya's own
photos rather than against a pricing table. Tags the same images with
several models and stores every result side by side in
`video_model_bakeoff`, then renders them as one comparison page.

```bash
# from workers/video-worker, with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
# ANTHROPIC_API_KEY and GEMINI_API_KEY in the environment
npx tsx src/scripts/bakeoff.ts --limit 12
npx tsx src/scripts/bakeoff-report.ts --run <run_id> --out bakeoff.html
```

| Flag | Meaning |
|---|---|
| `--limit N` | How many images (oldest first, so runs are comparable) |
| `--models a,b,c` | Subset of the candidate list |
| `--run ID` | Resume: skips cells that already succeeded |
| `TAG_PX` env | Long edge sent to the model, default 768 |

### Things learned running it that are easy to trip over again

- **Tag at 768px, not at the stored proxy size.** The proxies are
  ~1237x848. Measured on the same photo, dropping to 768px took
  gemini-3.1-flash-lite from 19.2s to 6.1s per call and cut the image
  tokens to roughly a third. The base64 payload dominates the request.

- **`gemini-2.5-flash-lite` is closed to new users.** It still appears
  in the models list, but `generateContent` returns 404 "no longer
  available to new users". The cheap-Gemini case rested on 2.5
  pricing; the current-generation equivalent is `gemini-3.1-flash-lite`.

- **Gemini's image endpoint is flaky.** During this run it returned
  200, 503 and 404 for the same request within seconds. The 404s are
  capacity, not a bad model name (a retired model says so in the body).
  Retries with backoff are mandatory, and roughly 2-3 attempts per
  image were needed, which is why a Gemini pass takes far longer in
  wall clock than its latency figure suggests.

- **Anthropic prompt caching only engages above a minimum prefix.**
  Our vocabulary system prompt is ~830 tokens. Sonnet 5 cached it;
  Haiku 4.5 reported zero cached tokens on every call, so Haiku pays
  full input on the whole prompt for every image and is worse value
  than its sticker price suggests. The same is true of Gemini explicit
  caching, which declines the prompt as too short and falls back to
  inline (see `cacheSystemPrompt` in ai/gemini-vision.ts).

- **Run it again before changing the vision model.** The role lives in
  `video_maker_model_roles`, so switching is an UPDATE with no
  redeploy, which makes it cheap to justify the choice with evidence.

`.bakeoff-cache/` holds the downscaled renders so a resumed run does
not re-download from Supabase storage. It is gitignored.
