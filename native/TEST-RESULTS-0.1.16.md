# Late-ad test build — 0.1.16

## Reproduced gap

The 0.1.15 browser fixture was extended to simulate responses arriving after
initial playback. It failed on `fetch('/youtubei/v1/next')`: `playerAds` survived.
The original tests covered initial globals and Shorts JSON, not this path.
This is a demonstrated filtering gap, not a capture of the user's live post-roll.

## Correction

Two app-owned uBO-compatible scriptlet rules strip known ad-only fields from
late player/next/get_watch/ad_break responses. Rules are applied after loading
the baseline or a cache; downloaded updates cannot silently omit them. Filter
diagnostics include `+pake-late-ads-1`. Required scriptlet resources are validated.
No changes to player timing, media seeking, fullscreen, captions or the profile.

## Automated results

- Four Rust tests pass, including rules applied to cached bundles and rejection
  of a bundle missing a required late-response scriptlet.
- 192 late-response cases pass: enabled/disabled × two SPA navigation phases ×
  four endpoints × three URL/payload variants × four transports.
- Variants cover queryless/query URLs and array-wrapped JSON; transports cover
  fetch URL strings, Request objects, XHR text and XHR JSON.
- Media streams, captions, end-screen links and recommendation data remain.
- Unrelated browse responses and non-JSON HTTP 503 errors are unchanged.
- Original early scriptlet, cosmetic and Trusted Types UI fixtures still pass.

## Manual acceptance

The user tested this executable and reported that there were no post-roll ads,
then requested release publication. That confirms their observed case, not
every video, account or server-side ad variant. A full autoplay/on-off and
playback/captions/fullscreen matrix was not separately reported.

## Built artifacts

Windows x64 release EXE and MSI built successfully on 2026-09-18. Existing
installed app was closed normally before launching the root test executable
with the unchanged YouTube profile. No installer was run during that test.
The release reuses these exact artifacts without rebuilding.

```text
YouTube.exe  D575DDE7134601556FB1ABB51F405EF7E8550CB24FF6568FBB11F57E12A82A0D
YouTube.msi  300472E7E2C7A9A512387C0DF5912A20D618E9F6E760218A909A27D7DE5A556A
```
