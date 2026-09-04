/* narthex/livestream — reveal a link and fill players when a YouTube channel is live.
 *
 * ROLES  (vci-livestream="…")
 *   link     an <a> kept hidden until the channel is confirmed live, then pointed
 *            at the watch URL and revealed.
 *   embed    a container holding exactly one <iframe>. Filled with a muted,
 *            chromeless, autoplaying background player, faded in once YouTube's
 *            startup chrome has cleared — for a hero notice.
 *   player   a container holding one <iframe>. A real player the visitor drives.
 *            Off-air it shows YouTube's own channel live-stream card (which
 *            costs no search quota), so a /live page is never an empty box.
 *
 * SETTINGS (vci-livestream-<setting>, on the <script> tag / vci.settings.livestream / <html>)
 *   key      YouTube Data API v3 key (referrer-restricted in Google Cloud). Required.
 *   handle   channel handle, with or without @. Required.
 *   days     days the live check runs, comma list of sun,mon,… or "all". Default sun.
 *   tz       IANA zone the days are judged in. Default America/Chicago.
 *   test     query-string flag that forces the check any day. Default livestream=test.
 *   cache    minutes to cache the live result per session. Default 5.
 *
 * QUOTA — the reason this is shaped the way it is. channels.list costs 1 unit,
 * search.list 100, against a 10,000/day PROJECT ceiling shared by every visitor.
 * So: the channel id is cached in localStorage forever, the search result per
 * session, and the search only runs on the configured days. Even so a busy
 * morning can spend it; the fix then is a cached server-side check, not a
 * bigger number here.
 *
 * EVENTS  vci:livestream:live on document, detail { videoId } · vci:livestream:offline
 */
vci.define('livestream', function (vci) {
  'use strict';
  var w = window, d = document;
  var M = 'livestream';
  var TAG = '[' + vci.prefix + ' livestream]';
  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  function cacheGet(store, key) { try { return store.getItem(key); } catch (e) { return null; } }
  function cacheSet(store, key, value) { try { store.setItem(key, value); } catch (e) {} }

  function run() {
    var links = vci.all(M, 'link');
    var embeds = vci.all(M, 'embed');
    var players = vci.all(M, 'player');
    // Ships on every page; most pages use none of the hooks and should cost nothing.
    if (!links.length && !embeds.length && !players.length) return;

    // Hidden in JS rather than CSS so the notice still renders on the Designer canvas.
    links.forEach(function (l) { l.style.display = 'none'; });

    var KEY = String(vci.config(M, 'key', '')).trim();
    var HANDLE = String(vci.config(M, 'handle', '')).trim().replace(/^@/, '');
    if (!KEY) { console.error(TAG + ' vci-livestream-key is empty.'); return; }
    if (!HANDLE) { console.error(TAG + ' vci-livestream-handle is empty.'); return; }

    var testFlag = vci.config(M, 'test', 'livestream=test');
    var force = w.location.search.slice(1).split('&').indexOf(testFlag) > -1;
    var days = vci.list(vci.config(M, 'days', 'sun')).map(function (s) { return s.toLowerCase().slice(0, 3); });
    var today = new Intl.DateTimeFormat('en-US', { timeZone: vci.config(M, 'tz', 'America/Chicago'), weekday: 'short' })
      .format(new Date()).toLowerCase();
    var checkLive = force || days.indexOf('all') > -1 || days.indexOf(today) > -1;
    if (!checkLive && !players.length) return;

    function api(path, params) {
      params.key = KEY;
      var url = 'https://www.googleapis.com/youtube/v3/' + path + '?' + new URLSearchParams(params).toString();
      return fetch(url).then(function (res) {
        if (res.ok) return res.json();
        return res.text().then(function (body) {
          console.error(TAG + ' YouTube ' + path + ' returned ' + res.status +
            (res.status === 403 ? ' — either the daily quota is spent or the API key\u2019s HTTP-referrer restrictions reject this domain.' : ''), body);
          return null;
        });
      });
    }
    function channelId() {
      var ck = vci.prefix + '-yt-channel-' + HANDLE;
      var cached = cacheGet(w.localStorage, ck);
      if (cached) return Promise.resolve(cached);
      return api('channels', { part: 'id', forHandle: HANDLE }).then(function (ch) {
        if (!ch) return null;
        var id = ch.items && ch.items[0] && ch.items[0].id;
        if (!id) { console.error(TAG + ' no channel found for handle @' + HANDLE + '.'); return null; }
        cacheSet(w.localStorage, ck, id);
        return id;
      });
    }
    function liveVideoId(id) {
      var ck = vci.prefix + '-yt-live';
      var cached = cacheGet(w.sessionStorage, ck);
      if (cached) {
        var parts = cached.split('|');
        if (Number(parts[0]) > Date.now()) return Promise.resolve(parts[1] || null);
      }
      return api('search', { part: 'snippet', channelId: id, eventType: 'live', type: 'video', maxResults: '1' })
        .then(function (live) {
          if (!live) return null;
          var item = live.items && live.items[0];
          var videoId = (item && item.id && item.id.videoId) || '';
          var ttl = vci.num(vci.config(M, 'cache', '5'), 5) * 60 * 1000;
          cacheSet(w.sessionStorage, ck, (Date.now() + ttl) + '|' + videoId);
          return videoId || null;
        });
    }
    function whenPlayerReady(cb) {
      if (w.YT && w.YT.Player) { cb(); return; }
      var prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = function () { if (typeof prev === 'function') prev(); cb(); };
      if (!d.getElementById('yt-iframe-api')) {
        var s = d.createElement('script');
        s.id = 'yt-iframe-api';
        s.src = 'https://www.youtube.com/iframe_api';
        d.head.appendChild(s);
      }
    }
    function fallbackToLink(container) {
      var box = container.firstElementChild || container;
      box.innerHTML = '<a href="https://www.youtube.com/@' + HANDLE + '/live" target="_blank" rel="noopener" ' +
        'style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:1rem;">Watch on YouTube</a>';
    }
    function iframeIn(container) {
      var f = container.querySelector('iframe');
      if (!f) console.error(TAG + ' container has no <iframe> inside it.', container);
      return f;
    }

    channelId().then(function (id) {
      if (!id) { players.forEach(fallbackToLink); return null; }
      players.forEach(function (c) {
        var f = iframeIn(c);
        if (f && !f.src) f.src = 'https://www.youtube.com/embed/live_stream?channel=' + id;
      });
      if (!checkLive) return null;
      return liveVideoId(id);
    }).then(function (videoId) {
      if (!videoId) {
        if (checkLive) { vci.log('nothing live right now — link stays hidden.'); vci.emit(d, 'livestream:offline', {}); }
        return;
      }
      vci.emit(d, 'livestream:live', { videoId: videoId });
      links.forEach(function (l) { l.href = 'https://www.youtube.com/watch?v=' + videoId; l.style.display = ''; });
      players.forEach(function (c) {
        var f = iframeIn(c);
        if (f) { c.style.display = ''; f.src = 'https://www.youtube.com/embed/' + videoId + '?rel=0&playsinline=1'; }
      });
      embeds.forEach(function (c) {
        var f = iframeIn(c);
        if (!f) return;
        c.style.display = '';
        f.style.opacity = '0';
        f.style.transition = 'opacity 300ms ease';
        f.src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&enablejsapi=1';
        whenPlayerReady(function () {
          new w.YT.Player(f, { events: {
            onReady: function (e) { e.target.mute(); e.target.playVideo(); },
            onStateChange: function (e) {
              if (e.data === w.YT.PlayerState.PLAYING) setTimeout(function () { f.style.opacity = '1'; }, 6000);
            }
          } });
        });
      });
    }).catch(function (err) { console.error(TAG + ' check failed:', err); });
  }

  vci.ready(run);
  return { run: run };
});
