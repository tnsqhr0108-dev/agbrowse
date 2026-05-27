# Runway Custom Model Smoke Tests

Date: 2026-05-27
Surface: `Custom` / `Video` + `Image`
Method: logged-in Chrome session, Computer Use for live UI actions, read-only
`agbrowse runway poll` for terminal verification.

## Purpose

The earlier Custom live probe mapped the controls and proved one `Seedance 2.0`
generation path. This follow-up smoke pass checks individual Custom models one
by one with the smallest viable input.

Smoke status terms:

- `completed`: Runway rendered an output video player.
- `queued`: Runway accepted the job and created a new output item, but rendering
  had not completed at the time of the note.
- `blocked`: the model was selectable, but Runway did not accept the submit
  attempt with the current state.
- `blocked_by_queue`: the model was selectable and the submit control appeared
  available, but Runway did not create a new output item while two jobs were
  already active in the session.
- `requires_input`: model selection changed the form and revealed a missing
  required input.

Safety notes:

- Notification `Enable` was not clicked.
- Result `Share`, `Download`, `4K`, delete, and payment-like controls were not
  clicked.
- Output generation was user-authorized for this live smoke pass.

## Common Inputs

Base prompt:

```text
A calm cinematic five second shot of a small silver robot walking across a sunlit wooden desk, soft morning light, shallow depth of field, no text, no logos.
```

Reusable first-frame source:

- The completed `Seedance 2.0` output exposed `Use frame`.
- `Use frame` successfully populated image/video required slots for later
  video models.

Observed queue behavior:

- Runway accepted two active video jobs at a time in this session.
- A third submit could appear enabled in the UI but did not create a new output
  item until one existing job moved out of the active queue.
- For future automated smoke, each accepted model needs a poll window of up to
  10 minutes. A click on `Generate` alone is not a completion signal.

## Poll Contract

Runway is queue-based, so the smoke runner must record these events separately:

1. `model_selected`: model picker row selected and the expected form appeared.
2. `submit_attempted`: `Generate` was clicked only when the user authorized live
   generation.
3. `submit_accepted`: the right rail output count increased or a new indexed
   loading item appeared.
4. `terminal_result`: the active item stopped showing loading/progress signals
   and exposed a media/output artifact.
5. `queue_full`: Runway showed `You're on a roll` / `Please wait for your last
   generation to complete` / `Credits Mode`; do not switch to Credits Mode.

Implementation default:

```bash
agbrowse runway poll --timeout 600000 --interval 5000 --queue-limit 2 --json
```

The queue cap for Unlimited smoke is treated as `2`. A third model should wait
for one active item to finish or be recorded as `queue_full`, not as completed.

Read-only poll evidence from the same logged-in Runway tab:

- `state: idle`
- `completionSignal: no-active-generation-signals`
- `queue.activeCountEstimate: 0`
- `submitEvidence.outputItemCount: 26`
- terminal artifact slugs observed after the image pass:
  `magnific_precision_upscaler_v2`, `bfl_flux_2_max`,
  `bfl_flux_2_klein`, and `magnific_creative_upscaler`

## Video Smoke Results

| Order | Provider | Model | Capability label | Input used | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ByteDance | Seedance 2.0 | Multi-modal control | Uploaded/generated reference + prompt | completed | Earlier Custom probe completed a video player. During setup for this pass, a duplicate Seedance submit also completed; this was accidental after a stale action hit `Generate`. |
| 2 | Runway | Gen-4.5 | Image/Text to Video | Text prompt only | completed | Submitted from selected `Gen-4.5`; progressed from queue to `10%`, `21%`, then completed as `Gen-4_5 - ...` video player. |
| 3 | Runway | Gen-4 | Image to Video | `Use frame` from completed Seedance output + prompt | completed | Selecting the model changed the slot label to `First Video Frame (required)`. After `Use frame`, submit created thumbnail/output item 4 with a `task_artifact_previews` image. |
| 4 | Alibaba | HappyHorse 1.0 | Text/Image to Video | `Use frame` from completed Seedance output + prompt | completed | Initial submit attempts did not create an item while two jobs were active. After Gen-4.5 completed, submit created item 5 and later exposed a `happyhorse-1-0/.../video-previews/...` thumbnail. |
| 5 | Runway | Gen-4 Turbo | Image to Video | `Use frame` from completed Seedance output + prompt | limited | Model selected successfully and Runway showed `You're ready to generate.` Submit then showed `You're on a roll! Please wait for your last generation to complete, or switch to Credits Mode.` A new right-rail item appeared, but terminal state still needed follow-up. Credits Mode was not used. |
| 6 | Runway | Characters | Text/Image to Character Video, Audio | `Use frame` image + text script + default `Maya` voice | blocked | Model selection changed the form to `Character script`, `Text/Audio` input mode, and voice preview. Script entry succeeded. Submit did not create a new output while existing jobs were active. |
| 7 | Runway | Act-Two | Character Animation | Tried asset picker; no driving video selected | requires_input | Selecting this row switched to `mode=apps&app=act-two`. The app requires `Performance` video plus `Character` image/video. The built-in `Getting Started` folder exposed image samples only for the performance picker, so generation was not submitted. |
| 8 | Runway | Aleph 2.0 | Edit videos | Uploaded `/tmp/runway_custom_smoke_260527.mp4` + edit prompt | completed | Selecting this row switched to `mode=edit` / Edit Studio. Local MP4 upload succeeded, prompt entry succeeded, and `Generate frame` entered `Generating...`. Returning to Custom showed right-rail item 7, which later completed as an edited still/image artifact in the feed. |
| 9 | Kling | Kling O3 4K | Keyframes, Multishot, References, Audio | `Use frame` first frame + prompt | completed | Model selection preserved the frame prompt, exposed `Frames`/`Multishot`, `Last Video Frame`, references toggle, audio `On`, `16:9`, and `5s`. Submit created right-rail item 8, which later completed as `Kling O3 4K - ...mp4`. |
| 10 | Kling | Kling O3 Pro | Keyframes, Multishot, Edit Video, Audio | `Use frame` first frame + prompt | blocked_by_queue | Model selected successfully and exposed `Frames`/`Multishot`/`Edit Video`. `Generate` appeared enabled, but clicking it did not create right-rail item 9 while Aleph 2.0 was still `Generating` and Kling O3 4K was still queued. |
| 11 | Kling | Kling O3 Standard | Keyframes, Multishot, Edit Video, Audio | `Use frame` first frame + prompt | blocked_by_queue | Model selected successfully. `Generate` appeared enabled, but clicking it still left the right rail at item 8 while Aleph 2.0 had only advanced to 9% and Kling O3 4K remained queued. |
| 12 | Kling | Kling 3.0 4K | Keyframes, Multishot, Audio | `Use frame` first frame + prompt | completed | Model selected successfully. After Aleph 2.0 completed, `Generate` created right-rail item 9. Later observation showed item 9 as a completed `kling-3-0-4k/.../video-previews/...` thumbnail. |
| 13 | Kling | Kling 3.0 Pro | Keyframes, Multishot, Audio | `Use frame` first frame + prompt | blocked_by_queue | Model selected successfully with the same `Frames`/`Multishot` form shape as `Kling 3.0 4K`. `Generate` did not create item 10 while items 8/9 were active. |
| 14 | Kling | Kling 3.0 Standard | Keyframes, Multishot, Audio | `Use frame` first frame + prompt | blocked_by_queue | Model selected successfully and preserved the prompt/frame inputs. `Generate` did not create an additional right-rail item while the active queue was full. |
| 15 | Kling | Kling 3.0 Motion | Character Animation | Default performance panel + `Use frame` character image | requires_input | Model selection changed the form to `Performance` and `Character`. The character image was populated from the robot frame, but the performance panel still showed `Unable to play media` plus `Select`/`Record`; submit did not create a new output. |
| 16 | Kling | Kling 2.6 Pro | Image/Text to Video, Audio | `Use frame` image + re-entered prompt | queued | Model selection changed the form to single image + prompt and cleared the prompt once. `set_value` did not stick, but focused keyboard input restored the prompt; submit created right-rail item 10. |
| 17 | Kling | Kling 2.5 Turbo Pro | Keyframes | `Use frame` first frame + prompt | blocked_by_queue | Model selected successfully and preserved prompt/keyframe inputs. `Generate` did not create item 11 while items 9/10 were active. |
| 18 | Kling | Kling 2.5 Turbo | Image to Video | `Use frame` image + prompt | blocked_by_queue | Model selected successfully. `Generate` did not create item 11 while items 9/10 were active. |
| 19 | Google | Veo 3.1 | Keyframes, Audio | `Use frame` first frame + prompt | blocked_by_queue | Model selected successfully and exposed first-frame plus optional last-frame inputs, audio `On`, `16:9`, `1080p`, and `8s`. `Generate` did not create item 11 while right-rail items 9/10 were still loading. Credits Mode was not used. |
| 20 | Google | Veo 3 | Image/Text to Video, Audio | `Use frame` image + prompt | blocked_by_queue | Model selected successfully and exposed a single image input with prompt, `16:9`, and `8s`. `Generate` did not create item 11 while right-rail items 9/10 were still loading. |
| 21 | WAN | WAN 2.6 | Image/Text to Video, Audio | `Use frame` image + prompt | blocked_by_queue | Model selected successfully and exposed a single image input with prompt, audio `On`, `16:9`, `1080p`, and `5s`. `Generate` did not create item 11 while right-rail items 9/10 were still loading. |
| 22 | WAN | WAN 2.6 Flash | Image/Text to Video, Audio | `Use frame` image + prompt | blocked_by_queue | Model selected successfully with the same single image/prompt shape as `WAN 2.6`, including audio `On`, `16:9`, `1080p`, and `5s`. `Generate` did not create item 11 while right-rail items 9/10 were still loading. |
| 23 | WAN | WAN 2.2 Animate | Character Animation | Default performance panel + `Use frame` character image | requires_input | Model selection changed the form to `Performance` and `Character`. The character image was populated from the robot frame, but the performance panel remained a `Select`/`Record` driving-video slot; submit did not create a new output. |
| 24 | Runway Legacy | Gen-3 Alpha Turbo | Camera, keyframes | `Use frame` keyframe + re-entered prompt | blocked_by_queue | Picker showed `Gen-3 Alpha Turbo`, but the selected form label shortened to `Gen-3 Turbo`. Selection cleared the previous input; `Use frame` repopulated a keyframe and focused keyboard input restored the prompt. `Generate` did not create item 11 while right-rail items 9/10 were active. |
| 25 | Runway Legacy | Gen-3 Alpha | Camera, first and last frame | Reused Gen-3 keyframe + prompt | queued | Picker showed `Gen-3 Alpha`, but the selected form label shortened to `Alpha`. The form exposed `First`/`Last` frame toggles, preserved the keyframe/prompt, and `Generate` created right-rail item 11 in loading state. |

## Pending Video Models

Google:

- None remaining.

WAN:

- None remaining.

Legacy:

- None remaining.

## Image Smoke Results

Common image input:

- Reference image: `Use frame` from the completed Seedance/Kling outputs,
  populated as `frame-0-a00f342d-976c-450a-b781-e69557abe4f3.jpg`.
- Prompt: same base prompt as the video pass.
- Output mode: `Image`.

| Order | Provider | Model | Capability label | Input used | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Magnific | Upscaler Precision v2 | Upscale Image | `Use frame` reference image | completed | Default image model after switching to Image. Settings exposed `Flavor: Sublime`, `Scale: 2x`, `Sharpness 10`, `Smart grain 10`, `Ultra detail 30`. Submit created item 12, later completed as `magnific_precision_upscaler_v2/...png`. |
| 2 | OpenAI | GPT Image 2 | Image to Image, Text to Image | Reference image + prompt | blocked_by_queue | Prompt limit `32000`; aspect observed `21:9`, output count `1`. Initial `Generate` element went stale and was retried; no new item appeared. |
| 3 | Google | Nano Banana 2 | Gemini 3.1 Flash Image | Reference image + prompt | blocked_by_queue | Prompt limit `5000`; aspect `21:9`. Submit showed/kept the queue gate behavior; no new item. |
| 4 | Google | Nano Banana | Gemini 2.5 Flash Image | Reference image + prompt | blocked_by_queue | Same `5000` prompt limit and image-to-image form family. No new item while active jobs were present. |
| 5 | Google | Nano Banana Pro | Gemini 3 Pro Image | Reference image + prompt | blocked_by_queue | Existing feed contained an older Nano Banana Pro edit artifact, but the base-prompt smoke did not create a new output. |
| 6 | OpenAI | GPT Image 1.5 | Image to Image, Text to Image | Reference image + prompt | blocked_by_queue | Prompt limit `32000`; aspect changed to `3:2`. No new right-rail item. |
| 7 | OpenAI | GPT Image 1 Mini | Image to Image, Text to Image | Reference image + prompt | blocked_by_queue | Prompt limit `32000`; aspect `3:2`. No new right-rail item. |
| 8 | xAI | Grok Imagine | Image to Image, Text to Image | Reference image + prompt | blocked_by_queue | Prompt limit `2500`; aspect `3:2`. No new right-rail item. |
| 9 | Runway | Gen-4 Turbo | Image to Image | Reference image + prompt | blocked_by_queue | Form switched to `References / Styles`, prompt limit `1000`, aspect `4:3`. No new item while video items 10/11 were still active. |
| 10 | Runway | Gen-4 | Image to Image, Text to Image | Reference image + prompt | blocked_by_queue | Same Runway image form shape as Gen-4 Turbo. Submit did not create item 13 while existing active jobs were still progressing. |
| 11 | Black Forest Labs | FLUX.2 Max | Image to Image, Text to Image | Reference image + prompt | completed | Prompt limit `4000`, aspect `4:3`, `1K`, `jpeg`. Submit created right-rail item 13 in loading state. Later read-only poll found a completed `bfl_flux_2_max/...jpg` artifact. |
| 12 | Black Forest Labs | FLUX.2 Klein | Image to Image, Text to Image | Reference image + prompt | completed | Same FLUX form shape as Max. Initial observation looked queue-blocked, but later read-only poll found two completed `bfl_flux_2_klein/...jpg` artifacts. |
| 13 | ByteDance | Seedream 5.0 | Image to Image, Text to Image | Reference image + prompt | blocked_by_queue | Prompt limit `4000`, aspect `4:3`, `2K`. Submit produced the explicit queue gate toast. |
| 14 | Magnific | Upscaler Creative | Upscale Image | Reference image | completed | Form switched to Magnific Creative controls: `Optimized for`, `Scale 2x`, `Creativity 0`, `HDR 0`, `Resemblance 5`, `Fractality 0`. Submit entered `Generating...`; later read-only poll found a completed `magnific_creative_upscaler/...png` artifact. |

## Pending Image Models

- None remaining from the observed Image picker model list.

## Pending Audio Models

- Audio surface was not completed in this pass. Computer Use became unstable
  after the image pass: `element ID is no longer valid`, then repeated
  `cgWindowNotFound`, and a coordinate click timed out at 120s.
- A read-only poll later reported the queue idle and the visible form on an
  Audio-like `Performance`/`Character` surface (`WAN 2.2`), but no Audio model
  list or accepted Audio generation was verified in this pass.
- Next pass should switch to Audio only after `agbrowse runway poll` reports the
  current Image/Video queue is below the cap, then enumerate Audio models with
  the same 10-minute terminal poll rule.

## Implementation Implications

- `agbrowse runway` must treat `Generate` as a stateful submit, not a simple
  button click. The safe flow needs a per-model readiness check and an active
  queue cap.
- The smoke runner should poll up to 10 minutes per accepted job and record
  `queue_full` as a terminal blocked state, not a failure to click.
- Unlimited mode queue capacity observed in this pass is two active jobs.
- Image/video-required models need an explicit asset source strategy:
  uploaded file, asset picker selection, or `Use frame` from an earlier output.
- Image models have provider-specific prompt limits, aspect controls, output
  formats, and special form families (`References / Styles`, Magnific upscaler
  controls).
- A future automated smoke runner should record three separate events per model:
  model selected, submit accepted, and terminal render result.
