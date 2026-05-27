# Runway Custom Live Probe

Date: 2026-05-27
Surface: `https://app.runwayml.com/video-tools/ai-tools/generate?mode=tools`
Observed URL shape: `/video-tools/teams/<team>/ai-tools/generate?mode=tools&tool=<image|video|audio>&sessionId=<uuid>`
Method: logged-in Chrome session, Computer Use primary, read-only `agbrowse runway status --json` for final selector sanity check.

## Scope

This pass focused only on Runway `Custom` because the user confirmed this is an Unlimited-relevant surface. `Apps` remains the other deep automation surface from the earlier capture; `Agent`, `Recents`, `Workflow`, and `Characters` remain surface-only for now.

Live state confirmed:

- User is logged in; no Login/Sign up text was visible.
- Top quota button shows `Unlimited`.
- `Custom` supports three output modes: `Image`, `Video`, `Audio`.
- Direct Custom URL works while logged in; Runway expands it to a team-scoped URL.

## Stable DOM Contract

Final read-only status from `agbrowse runway status --json` on the completed video session:

- Surface detected: `custom-tools`
- Deep automation target: `true`
- Present selectors:
  - `[data-testid="mira-app-sidebar"]`
  - `[data-testid="credit-info-button"]`
  - `div[aria-label="Prompt"]`
  - `input[type="file"]`
  - `[data-testid="select-base-model"]`
  - `#related-apps-trigger`
  - `button[title="Click to rename"]`
- Counts:
  - buttons: `58`
  - inputs: `11`
  - file inputs: `1`
- Missing selector expected for this surface:
  - `input[placeholder="Describe your creation or search apps"]` belongs to Apps/search, not Custom tools.

Safety note: `agbrowse runway status/open/preflight` remains read-only and still blocks Generate/Run all/payment/destructive/submit-like controls. The live Generate action in this document was performed manually through Computer Use because the user explicitly requested a real video creation test.

## Video Mode

Default observed state:

- Mode: `Video`
- Model: `Seedance 2.0`
- Input mode:
  - `Multi-reference`
  - `Keyframe`
- Reference controls:
  - Reference slot / asset selector
  - Uploaded references appear as `IMG_1`
  - Reference item controls: view larger, edit, remove
- Prompt:
  - `div[aria-label="Prompt"]`
  - prompt counter shown after typing, e.g. `157 / 3500`
  - `Enhance prompt`
  - `Presets`
- Settings:
  - References toggle
  - Audio toggle: `On` / `Off`
  - Aspect ratio: `16:9`, `21:9`, `4:3`, `1:1`, `3:4`, `9:16`
  - Resolution: `480p`, `720p`, `1080p`
  - Duration: `4 seconds` through `15 seconds`
  - View generation cost button was present; on Unlimited state it did not open a visible modal during this probe.
- Bottom controls:
  - `Helpful Apps when generating videos`
  - `Video models`
  - `Generate`

### Video Models

Categories and options observed from the live model picker:

| Category | Models |
| --- | --- |
| Recent | Seedance 2.0; Kling O3 4K; Gen-4.5 |
| Featured | Seedance 2.0; Kling 3.0 Pro; HappyHorse 1.0; Veo 3.1 |
| Runway | Gen-4.5; Gen-4 Turbo; Gen-4; Characters; Act-Two; Aleph 2.0 |
| ByteDance | Seedance 2.0 |
| Kling | Kling O3 4K; Kling O3 Pro; Kling O3 Standard; Kling 3.0 4K; Kling 3.0 Pro; Kling 3.0 Standard; Kling 3.0 Motion; Kling 2.6 Pro; Kling 2.5 Turbo Pro; Kling 2.5 Turbo |
| Google | Veo 3.1; Veo 3 |
| WAN | WAN 2.6; WAN 2.6 Flash; WAN 2.2 Animate |
| Alibaba | HappyHorse 1.0 |
| Legacy | Gen-3 Alpha Turbo; Gen-3 Alpha |

Capability labels observed:

- Seedance 2.0: Multi-modal control
- Kling O3 4K: Keyframes, Multishot, References, Audio
- Gen-4.5: Image/Text to Video
- Kling 3.0 Pro: Keyframes, Multishot, Audio
- HappyHorse 1.0: Text/Image to Video
- Veo 3.1: Keyframes, Audio
- Gen-4 Turbo: Image to Video
- Gen-4: Image to Video
- Characters: Text/Image to Character Video, Audio
- Act-Two: Character Animation
- Aleph 2.0: Edit videos
- Kling O3 Pro / Standard: Keyframes, Multishot, Edit Video, Audio
- Kling 3.0 Motion: Character Animation
- Kling 2.6 Pro: Image/Text to Video, Audio
- Kling 2.5 Turbo Pro: Keyframes
- Kling 2.5 Turbo: Image to Video
- Veo 3: Image/Text to Video, Audio
- WAN 2.6 / WAN 2.6 Flash: Image/Text to Video, Audio
- WAN 2.2 Animate: Character Animation
- Gen-3 Alpha Turbo: Camera, keyframes
- Gen-3 Alpha: Camera, first and last frame

## Image Mode

Observed state:

- URL shape: `...generate?mode=tools&tool=image`
- Prompt field: `Text Prompt Input`
- Copy near prompt: `Describe your shot, add image references, or sketch a scene.`
- Entry helpers:
  - `Reference`
  - add image references
  - sketch a scene
  - Generate prompt from image
- Settings:
  - References toggle
  - output count button showing `4`
  - `Auto`
  - additional compact settings popover
  - View generation cost
- Bottom controls:
  - `Helpful Apps when generating images`
  - `Image models`
  - `Generate`

### Image Models

| Category | Models |
| --- | --- |
| Featured | GPT Image 2; Nano Banana 2; Grok Imagine; Seedream 5.0 |
| Google | Nano Banana 2; Nano Banana Pro; Nano Banana |
| OpenAI | GPT Image 2; GPT Image 1.5; GPT Image 1 Mini |
| xAI | Grok Imagine |
| Runway | Gen-4 Turbo; Gen-4 |
| Black Forest Labs | FLUX.2 Max; FLUX.2 Klein |
| ByteDance | Seedream 5.0 |
| Magnific | Upscaler Precision v2; Upscaler Creative |

Capability labels observed:

- GPT Image 2: Image to Image, Text to Image
- Nano Banana 2: Gemini 3.1 Flash Image
- Nano Banana Pro: Gemini 3 Pro Image
- Nano Banana: Gemini 2.5 Flash Image
- Grok Imagine: Image to Image, Text to Image
- Seedream 5.0: Image to Image, Text to Image
- GPT Image 1.5: Image to Image, Text to Image
- GPT Image 1 Mini: Image to Image, Text to Image
- Gen-4 Turbo: Image to Image
- Gen-4: Image to Image, Text to Image
- FLUX.2 Max / FLUX.2 Klein: Image to Image, Text to Image
- Upscaler Precision v2 / Upscaler Creative: Upscale Image

## Audio Mode

Observed state:

- URL shape: `...generate?mode=tools&tool=audio`
- Script field placeholder: `Type your script to turn into audio.`
- Voice search field: `Choose a voice from below or search`
- Tabs:
  - `Runway`
  - `Custom`
- Bottom controls:
  - View generation cost
  - `Helpful Apps when generating audio`
  - `Generate`

Runway voice list visible through the accessibility tree:

`Maya`, `Arjun`, `Serene`, `Bernard`, `Billy`, `Mark`, `Clint`, `Mabel`, `Chad`, `Leslie`, `Eleanor`, `Elias`, `Elliot`, `Grungle`, `Brodie`, `Sandra`, `Kirk`, `Kylie`, `Lara`, `Lisa`, `Malachi`, `Marlene`, `Martin`, `Miriam`, `Monster`, `Paula`, `Pip`, `Rusty`, `Ragnar`, `Xylar`, `Maggie`, `Jack`, `Katie`, `Noah`, `James`, `Rina`, `Ella`, `Mariah`, `Frank`, `Claudia`, `Niki`, `Vincent`, `Kendrick`, `Myrna`, `Tom`, `Wanda`, `Benjamin`, `Kiana`, `Rachel`.

Custom audio tab options:

- `Clone a voice` — record your own, or upload a clip.
- `Generate Voice` — describe a custom voice.

No audio generation was run in this pass; the user requested video creation as the live generation test.

## Asset Upload Probe

Uploaded local file:

- `/tmp/runway-custom-probe-260527/reference-from-runway-preview.png`
- File type observed by macOS picker: PNG image
- Size observed by macOS picker: 129 KB

Upload path:

1. Click Video `Reference`.
2. Asset selector opens.
3. Click `Drag and drop file (image or video)` drop zone.
4. macOS file picker opens.
5. Use Go to Folder and choose the PNG file.
6. Runway shows upload progress from `0%` to `100%`.
7. Modal closes and the left reference slot shows `IMG_1`.

After upload, Runway added a `sessionId` query parameter and exposed reference controls:

- `View IMG_1 larger`
- `Edit IMG_1`
- `Remove IMG_1`
- `IMG_1`

## Video Generation Probe

Generation settings used:

- Mode: `Video`
- Input mode: `Multi-reference`
- Model: `Seedance 2.0`
- Reference: `IMG_1`
- Aspect ratio: `16:9`
- Resolution: `720p`
- Duration: `5s`
- Audio: `On`
- Quota state: `Unlimited`

Prompt used:

```text
A calm cinematic five second shot of a small silver robot walking across a sunlit wooden desk, soft morning light, shallow depth of field, no text, no logos.
```

Observed lifecycle:

1. `Generate` click accepted.
2. Button became disabled and output panel showed `In queue`.
3. Status advanced to `9%`.
4. Status advanced to `40%`.
5. Output completed successfully.

Result state:

- Auto title: `Silver Robot Morning Walk`
- Output filename shown: `Seedance 2_0 - A calm cinematic five second shot of a small silver robot walking across a sunlit woo.mp4`
- Output rendered as a video player with play/mute/time/rate/fullscreen controls.
- Result toolbar exposed:
  - `Apps`
  - `Use frame`
  - `Edit`
  - `Share`
  - `Favorite`
  - `4K`
  - additional popover/download controls

### Result Follow-up Menus

Continued Computer Use pass at 2026-05-27 11:39 KST confirmed the completed output exposes several follow-up paths:

- `Use frame options`:
  - `Input for video`
  - `Image reference`
- Download popover:
  - `Download MP4`
  - `Download GIF`
  - `Download As...`
- Result `Apps` popover:
  - `Edit Studio`
  - `Use as Character in Performance Capture with Act-Two`
  - `Use as Performance in Performance Capture with Act-Two`
  - `Retime Video`
  - `Remove from Video`
  - `Expand Video`
  - `Use current frame in image`
  - `Use current frame in video`
  - `Upscale Video`
  - `Extend Video`
  - `Video Backdrop`
  - `Color Grade Video`
  - `Video Lighting`
  - `Stylize Video`
  - `Video Time of Day`
  - `Video Weather`

Automation note: these are post-output actions. They should be modeled separately from initial generation because many of them create a new app/editor flow.

### Video Model Form Variants

The model picker is not just a model value switch; several options rewire the whole input form:

| Model | Observed form behavior |
| --- | --- |
| Seedance 2.0 | `Multi-reference` / `Keyframe`; reference slots; prompt; References; Audio On/Off; aspect/resolution/duration. |
| Gen-4.5 | `First Video Frame` upload/select block; text prompt; aspect; `5s`; `Advanced Settings`; cost tooltip showed `Free in Explore Mode`. |
| Kling O3 4K | `Frames` mode has first/last frame blocks plus `Reference`; `Multishot` mode has Shot 1/Shot 2 prompts, per-shot `3s`, `Add shot`, total `6s`, Audio On. |
| Gen-4 Turbo | `First Video Frame (required)` with `Upload`, helper `Generate`, and `Select`; prompt; aspect; `5s`; `Advanced Settings`; cost tooltip showed `Free in Explore Mode`. |
| Gen-4 | Similar to Gen-4 Turbo required first-frame flow; exposed `16:9`, `5s`, `Advanced Settings`, cost; no resolution toggle observed in this pass. |
| Veo 3.1 | Optional `First Video Frame` and optional `Last Video Frame`; Audio On; `16:9`; `720p`; `8s`. |
| WAN 2.6 | `First Video Frame`; Audio On; `16:9`; `720p`; `5s`. |
| HappyHorse 1.0 | `First Video Frame`; `16:9`; `720p`; `5s`; no Audio toggle was observed in the current form. |
| Aleph 2.0 | Selecting it routes to `mode=edit` / Edit Studio, not the normal Custom form. Requires video upload/select and shows presets like `Swap Product`, `Change Lighting`, `Change Background`, `Remove Anything`. |
| Act-Two | Selecting it routes to `mode=apps&app=act-two`. It uses Performance, Character, and Voices inputs with `Record`, `Select asset`, `Generate Character`, and `Generate Voice`. |
| Gen-3 Alpha Turbo | Legacy-style form: image/video drop zone, Text Prompt, Camera Control, Presets, Character (Act-One), Expand video, `10s` duration. Camera Control exposes Horizontal, Pan, Vertical, Tilt, Zoom, Roll sliders after image upload. |
| Gen-3 Alpha | Similar legacy form; model label becomes `Alpha`; capability is camera plus first/last frame; `10s` duration. |

Act-One inside Gen-3 Turbo is marked as deprecated and recommends Act-Two. Expand video requires a video input and is described as reframing to landscape or portrait.

### Image Detail Addendum

Additional Image-mode settings observed:

- Standard image generation (`Nano Banana 2` selected):
  - number of images: `1`, `4`
  - aspect ratios: `Auto`, `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`
  - image size: `1K`, `2K`, `4K`
- `Upscaler Precision v2` form:
  - requires image upload/select
  - `Flavor`: `Sublime`, `Photo`, `Photo denoiser`
  - `Scale`: `2x`, `4x`, `8x`, `16x`
  - sliders/inputs: `Sharpness`, `Smart grain`, `Ultra detail`

### Audio Detail Addendum

Additional Audio-mode custom voice paths:

- Custom `Generate Voice` opens a modal with one voice description text area and a disabled `Generate Voice` button until text is entered.
- Custom `Clone a voice` opens a modal with:
  - `Upload` tab
  - `Record` tab
  - upload requirement: audio files up to 10 MB each, 10 seconds through 5 minutes required
  - record guidance: 1-2 minutes of clear speech, varied tone, minimal background noise
  - example script and `Copy`
  - `Start Recording`

No extra Generate or Start Recording action was clicked during this continuation pass.

## Automation Implications

Custom should be treated as a task-runner surface, not a chat surface:

- Deep automation target: yes.
- Safe read-only commands: `selectors`, `status`, `open`, `preflight`.
- Mutating actions require an explicit user-requested mode:
  - upload reference media
  - type prompt
  - choose model/settings
  - click Generate
  - wait for output state
- A future `agbrowse runway generate` should require explicit `--execute` or equivalent, and should default to dry-run/preflight otherwise.

Suggested next implementation slice:

- Add Custom model inventory snapshot command that opens the model picker and enumerates categories without clicking Generate.
- Add file upload support behind an explicit action flag.
- Add generation polling that recognizes `In queue`, `%`, completed video player, and failed/error states.
- Keep Login button handling as a preflight step because Runway may show Login even in an otherwise authenticated browser profile.
