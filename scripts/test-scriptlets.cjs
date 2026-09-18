// Real browser fixture; every request is served locally, no YouTube/account data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const script = execFileSync('cargo', ['run','--quiet','--locked','--manifest-path','native/core/Cargo.toml','--example','export-script'], {
  cwd:root, encoding:'utf8', maxBuffer:8*1024*1024,
  env:{...process.env,CARGO_TARGET_DIR:path.join(root,'.build-target')}
});
const ui = fs.readFileSync(path.join(root,'native/ui.js'),'utf8');
const playerResponse = {
 playerAds:[{kind:'postroll'}],adPlacements:[{kind:'postroll'}],adSlots:[{kind:'postroll'}],
 videoDetails:{videoId:'fixture'},streamingData:{adaptiveFormats:[{url:'https://media.test/content'}]},
 captions:{playerCaptionsTracklistRenderer:{captionTracks:[{languageCode:'en'}]}},
 endscreen:{endscreenRenderer:{elements:[{videoId:'next-video'}]}}
};
const latePayload = { ...playerResponse, playerResponse, response:{contents:{twoColumnWatchNextResults:{keep:'recommendations'}}} };
const fixture = `<!doctype html><html><head><script>
  window.ytInitialPlayerResponse = {playerAds:[{ad:true}],adPlacements:[{ad:true}],adSlots:[{ad:true}],videoDetails:{videoId:'fixture'}};
  window.beforeSiteFinished = {ads:ytInitialPlayerResponse.playerAds,placements:ytInitialPlayerResponse.adPlacements,slots:ytInitialPlayerResponse.adSlots,video:ytInitialPlayerResponse.videoDetails.videoId};
  window.parsed = JSON.parse('{"entries":[{"command":{"reelWatchEndpoint":{"adClientParams":{"isAd":true}}}},{"videoId":"fixture"}],"videoDetails":{"videoId":"fixture"}}');
  </script></head><body><div id="contents"><ytd-rich-item-renderer id="ad"><ytd-ad-slot-renderer>advertisement fixture</ytd-ad-slot-renderer></ytd-rich-item-renderer></div><div id="content">Normal content</div></body></html>`;
(async()=>{
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  for (const enabled of [true,false]) {
   const context = await browser.newContext();
   await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/youtubei/')) {
     if (url.searchParams.has('fixtureNonJson')) return route.fulfill({status:503,contentType:'text/plain',body:'temporarily unavailable'});
     const payload=url.searchParams.has('fixtureArray')?[latePayload]:latePayload;
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
    }
    return route.fulfill({status:200,contentType:'text/html',headers:{'Content-Security-Policy':"require-trusted-types-for 'script'; trusted-types none"},body:fixture});
   });
   await context.addInitScript({content:`localStorage.setItem('pake-adblock-enabled','${enabled?'1':'0'}');\n${script}\n${ui}`});
   const page = await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('https://www.youtube.com/watch?v=fixture');
   const result = await page.evaluate(()=>({early:beforeSiteFinished,jsonEntries:parsed.entries.length,jsonVideo:parsed.videoDetails.videoId,adDisplay:getComputedStyle(document.getElementById('ad')).display,contentDisplay:getComputedStyle(document.getElementById('content')).display,ui:!!document.getElementById('pake-blocker-controls')}));
   assert.equal(result.early.video,'fixture');assert.equal(result.jsonVideo,'fixture');assert.equal(result.ui,true);
   assert.notEqual(result.contentDisplay,'none');
   if(enabled) {
    assert.equal(result.early.ads,undefined);assert.equal(result.early.placements,undefined);assert.equal(result.early.slots,undefined);
    assert.equal(result.jsonEntries,1);assert.equal(result.adDisplay,'none');
   } else { assert.equal(result.early.ads.length,1);assert.equal(result.jsonEntries,2);assert.notEqual(result.adDisplay,'none'); }
   assert.deepEqual(errors,[]);
   console.log(`PASS: ${enabled?'enabled':'disabled'} early page script, JSON response, cosmetics, normal content, controls UI`);
   // Responses arriving after initial playback / same-document video navigation.
   for (const phase of ['initial-video','next-video']) {
    if (phase==='next-video') await page.evaluate(()=>history.pushState({},'', '/watch?v=next-video'));
    for (const endpoint of ['next','get_watch','player','player/ad_break']) {
     for (const query of ['', '?prettyPrint=false','?fixtureArray=1']) {
      for (const transport of ['fetch','request','xhr-text','xhr-json']) {
       const value=await page.evaluate(async ({endpoint,query,transport})=>{
        const url='/youtubei/v1/'+endpoint+query;
        if(transport==='fetch') return (await fetch(url)).json();
        if(transport==='request') return (await fetch(new Request(new URL(url,location.href)))).json();
        return new Promise((resolve,reject)=>{
         const xhr=new XMLHttpRequest();xhr.open('GET',url);
         xhr.responseType=transport==='xhr-json'?'json':'text';
         xhr.onload=()=>{try{resolve(xhr.responseType==='json'?xhr.response:JSON.parse(xhr.responseText));}catch(e){reject(e)}};
         xhr.onerror=()=>reject(Error('XHR failed'));xhr.send();
        });
       },{endpoint,query,transport});
       const container=Array.isArray(value)?value[0]:value;
       for(const response of [container,container.playerResponse]) {
        for(const field of ['playerAds','adPlacements','adSlots']) {
         assert.equal(Boolean(response[field]?.length),!enabled,`${phase} ${transport} ${endpoint}${query}: ${field}`);
        }
        assert.equal(response.videoDetails.videoId,'fixture');
        assert.equal(response.streamingData.adaptiveFormats[0].url,'https://media.test/content');
        assert.equal(response.captions.playerCaptionsTracklistRenderer.captionTracks[0].languageCode,'en');
        assert.equal(response.endscreen.endscreenRenderer.elements[0].videoId,'next-video');
       }
       assert.equal(container.response.contents.twoColumnWatchNextResults.keep,'recommendations');
      }
     }
    }
   }
   const untouched=await page.evaluate(async()=>{
    const unrelated=await (await fetch('/youtubei/v1/browse')).json();
    const failed=await fetch('/youtubei/v1/next?fixtureNonJson=1');
    return {unrelated,status:failed.status,text:await failed.text()};
   });
   assert.deepEqual(untouched.unrelated,latePayload);
   assert.equal(untouched.status,503);assert.equal(untouched.text,'temporarily unavailable');
   assert.deepEqual(errors,[]);
   console.log(`PASS: ${enabled?'enabled':'disabled'} late fetch/Request/XHR, queryless endpoints, SPA navigation; captions, media, endscreen and recommendations preserved`);
   // Same persistent preference governs later documents / SPA-style navigation.
   await page.reload();
   assert.equal(await page.evaluate(()=>localStorage.getItem('pake-adblock-enabled')),enabled?'1':'0');
   await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
