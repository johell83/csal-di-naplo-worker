/**
 * Családi napló — Worker API (Phase 2)  ·  API JSON pure sur D1, déployée comme Worker SÉPARÉ.
 * Le site statique (Worker "csaladinaplo") n'est PAS touché ; ce Worker ne gère que /api/*.
 *
 * Binding attendu (Dashboard → ce Worker → Settings → Bindings) :
 *   - DB : D1 Database → csaladinaplo-db  (compte 74a6608a…, uuid 1f35e32d-e7bb-4906-ab68-e1f46f778051)
 *
 * Secrets (Phase 3-4, Settings → Variables and Secrets, type "Secret") :
 *   - SZAMLAZZ_AGENT_KEY   - BARION_POSKEY
 *
 * CORS : ouvert (pas de cookies/credentials). Le front (csaladinaplo.hu) appelle l'URL de ce Worker.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', ...CORS };

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const bad = (msg, status = 400) => json({ ok: false, error: msg }, status);

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      const p0 = url.pathname.replace(/\/+$/, '') || '/';
      // Landing page served on / and /waitlist
      if (request.method === 'GET' && (p0 === "/" || p0 === "/waitlist")) {
        return new Response(LANDING_HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', ...CORS } });
      }
      // Other routes return JSON hint
      return json({ ok: true, service: 'csaladinaplo-api', hint: 'Utilise /api/health, /api/waitlist, /api/join, /api/posts, /api/journal, /api/subscribe' });
    }
    try {
      return await handleApi(request, env, url);
    } catch (err) {
      return bad('server_error: ' + (err && err.message ? err.message : String(err)), 500);
    }
  },

  // Cron Trigger (Dashboard → ce Worker → Settings → Triggers → Cron, ex. « 0 9 * * * » = tous les jours 9h UTC).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminders(env));
  },
};

/* --- Landing « voile » (teaser + formulaire d'intérêt) — servie sur GET / et /waitlist --- */
const LANDING_HTML = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Családi napló — Hamarosan · A család újságja, nyomtatva &amp; digitálisan</title>
<meta name="description" content="Családi napló — a család havi újságja: a család képei és történetei, nyomtatva a nagyszülőknek, alkalmazásban mindenkinek. Iratkozz fel, és értesítünk az indulásról!">
<meta name="robots" content="index,follow">
<link rel="icon" href="https://csaladinaplo.hu/assets/cn-favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&amp;family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&amp;family=Oswald:wght@400;500;600;700&amp;family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,600&amp;display=swap" rel="stylesheet">
<style>
/* Design system — Csaladi naplo (BRIEF valide 10 juin 2026) */
:root{
  --terracotta:#BC5E22; --terracotta-d:#9A4915; --terracotta-l:#C97A38;
  --gold:#D08A2C; --gold-l:#E6BC78;
  --paper:#FDFBF6; --paper-2:#F5F0E5; --paper-3:#E9E1D0; --cream:#F6ECD6;
  --brown:#7C6451; --brown-2:#5a4d3a; --ink:#241A10;
  --line:#D8C9B2; --line-2:#E0D4BC;
  --font-display:'Playfair Display',Georgia,serif;
  --font-meta:'Oswald','Arial Narrow',sans-serif;
  --font-body:'EB Garamond',Georgia,serif;
  --font-hand:'Caveat',cursive;
  --border-card:2px solid var(--ink); --tap:44px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;scroll-behavior:smooth}
body{font-family:var(--font-body);background:var(--paper);color:var(--ink);line-height:1.5;font-size:17px}
img{max-width:100%;display:block}
a{color:var(--terracotta-d)}
button{font:inherit;cursor:pointer}
.wrap{max-width:680px;margin:0 auto;padding:0 20px}
.hero-full{position:relative;min-height:100svh;width:100%;display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center;overflow:hidden;
  background:var(--ink) center/cover no-repeat;color:var(--cream);padding:48px 22px 96px}
.hero-full__bg{position:absolute;inset:0;z-index:0;background:url('https://img.csaladinaplo.hu/carousel/photo-1.jpg') center/cover no-repeat;
  background-color:var(--ink);transform:scale(1.12);opacity:0;
  animation:heroZoom 9s cubic-bezier(.16,.62,.32,1) forwards,heroFade 1.4s ease-out forwards}
@keyframes heroZoom{from{transform:scale(1.12)}to{transform:scale(1.0)}}
@keyframes heroFade{from{opacity:0}to{opacity:1}}
.hero-full__scrim{position:absolute;inset:0;z-index:1;opacity:0;animation:scrimFade 2.2s ease-out .3s forwards;
  background:linear-gradient(180deg,rgba(36,26,16,.62) 0%,rgba(36,26,16,.30) 26%,rgba(36,26,16,.30) 52%,rgba(36,26,16,.70) 100%)}
@keyframes scrimFade{from{opacity:0}to{opacity:1}}
.hero-full__inner{position:relative;z-index:3;max-width:680px;width:100%}
.hero-full .chip{display:inline-block;background:rgba(36,26,16,.55);color:var(--gold-l);
  border:1px solid rgba(230,188,120,.55);backdrop-filter:blur(3px);
  font-family:var(--font-meta);font-weight:600;text-transform:uppercase;letter-spacing:.2em;font-size:11px;
  padding:7px 18px;border-radius:2px;margin-bottom:26px}
.mast{display:flex;flex-direction:column;align-items:center;line-height:1}
.mast__rule{display:flex;align-items:center;gap:16px;width:min(440px,82%);margin:4px 0 18px}
.mast__rule .ln{flex:1;height:1.5px;background:var(--gold)}
.mast__rule .dia{width:9px;height:9px;transform:rotate(45deg);flex:none;background:var(--gold)}
.mast__word{font-family:var(--font-display);font-weight:800;letter-spacing:-.01em;
  font-size:clamp(46px,12vw,92px);line-height:1;color:#fff;text-shadow:0 2px 26px rgba(0,0,0,.55)}
.hero-full__tagline{margin-top:26px;font-family:var(--font-display);font-weight:700;font-style:italic;
  font-size:clamp(20px,4.4vw,30px);line-height:1.25;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.6)}
.hero-full__tagline em{color:var(--gold-l);font-style:italic}
.hero-full__alt{margin-top:14px;font-family:var(--font-body);font-style:italic;
  font-size:clamp(14px,2.4vw,17px);color:rgba(246,236,214,.92);text-shadow:0 1px 10px rgba(0,0,0,.6)}
.hero-cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;margin-top:34px;
  min-height:var(--tap);padding:14px 34px;font-family:var(--font-meta);font-weight:600;text-transform:uppercase;
  letter-spacing:.14em;font-size:14px;border-radius:2px;border:2px solid var(--gold);
  background:var(--terracotta);color:#fff;box-shadow:0 16px 34px -16px rgba(0,0,0,.7);
  transition:background .2s,transform .2s}
.hero-cta:hover{background:var(--terracotta-d);transform:translateY(-1px)}
.hero-scroll{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:3;
  display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--gold-l);
  font-family:var(--font-meta);font-weight:500;letter-spacing:.2em;text-transform:uppercase;font-size:10px;
  text-shadow:0 1px 6px rgba(0,0,0,.6);text-decoration:none}
.hero-scroll svg{width:20px;height:20px;animation:bob 1.8s ease-in-out infinite}
.pitch{margin:64px 0;text-align:center}
.pitch__rule{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:32px}
.pitch__rule .ln{flex:1;max-width:80px;height:1.5px;background:var(--terracotta)}
.pitch__rule .dia{width:8px;height:8px;transform:rotate(45deg);background:var(--terracotta)}
.cta{margin:80px 0;padding:40px 30px;border:var(--border-card);background:var(--paper-2)}
.cta h2{font-family:var(--font-display);font-weight:700;font-size:clamp(24px,5vw,36px);
  line-height:1.2;margin-bottom:16px;color:var(--ink)}
.lead{font-size:15px;color:var(--brown);margin-bottom:30px}
.field{margin-bottom:24px;text-align:left}
.field label{display:block;font-family:var(--font-meta);font-weight:600;text-transform:uppercase;
  letter-spacing:.12em;font-size:12px;color:var(--terracotta);margin-bottom:8px}
.field input,.field select{width:100%;padding:12px 14px;border:1px solid var(--line-2);
  background:white;font-family:inherit;font-size:inherit}
.field input:focus,.field select:focus{outline:none;border-color:var(--terracotta)}
.btn{display:block;width:100%;padding:14px 24px;background:var(--terracotta);color:white;
  border:none;font-family:var(--font-meta);font-weight:600;text-transform:uppercase;
  letter-spacing:.14em;font-size:14px;cursor:pointer;transition:background .2s}
.btn:hover{background:var(--terracotta-d)}
.btn:disabled{opacity:.6;cursor:not-allowed}
.form-msg{margin-top:12px;font-size:13px;color:var(--terracotta)}
.privacy{font-size:12px;color:var(--brown-2);margin-top:24px}
.hp{display:none}
.thanks{text-align:center;display:none}
.thanks.show{display:block}
.thanks h3{font-family:var(--font-display);font-weight:700;font-size:28px;margin-bottom:16px}
.sig{margin-top:24px;font-family:var(--font-hand);font-size:18px;color:var(--brown)}
.site-footer{background:#5a4d3a;color:white;padding:40px 20px;text-align:center}
.masthead-h{margin-bottom:24px}
.masthead-h__eyebrow{display:block;font-family:var(--font-meta);font-size:11px;
  text-transform:uppercase;letter-spacing:.2em;opacity:.8;margin-bottom:6px}
.masthead-h__word{display:block;font-family:var(--font-display);font-weight:700;
  font-size:28px;line-height:1;margin-bottom:8px}
.masthead-h__sub{display:block;font-size:13px;opacity:.9}
.site-footer__copy{font-size:12px;opacity:.75;margin-bottom:12px}
.site-footer__secret{display:inline-block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-top:8px;opacity:.4;transition:opacity 150ms ease}
.site-footer__secret:hover{opacity:.75}
.site-footer__secret{color:var(--gold-l);text-decoration:none}
</style>
</head>
<body>

<header class="hero-full" role="banner">
  <div class="hero-full__bg"></div>
  <div class="hero-full__scrim"></div>
  <div class="hero-full__inner">
    <div class="chip">Hamarosan — Coming Soon</div>
    <div class="mast">
      <div class="mast__rule" aria-hidden="true"><span class="ln"></span><span class="dia"></span><span class="ln"></span></div>
      <h1 class="mast__word">Család</h1>
      <h2 class="mast__word">napló</h2>
    </div>
    <p class="hero-full__tagline">A család havi <em>újságja</em></p>
    <p class="hero-full__alt"><span>Nyomtatva a nagyszülőknek</span> <span class="sep">·</span> <span>Digitalement pour tous</span> <span class="sep">·</span> <span>For the whole family</span></p>
    <a class="hero-cta" href="#erdekel">Érdekel — feliratkozom</a>
  </div>
</header>

<div class="wrap">

  <section class="pitch">
    <div class="pitch__rule" aria-hidden="true"><span class="ln"></span><span class="dia"></span><span class="ln"></span></div>
    <p>A család minden tagja <b>fotókat és rövid híreket</b> oszt meg az alkalmazásban — mi pedig minden hónapban <b>gyönyörű, nyomtatott újságot</b> készítünk belőle, és postázzuk a nagyszülőknek.</p>
  </section>

  <!-- CTA + FORMULAIRE (email) -->
  <section class="cta" id="erdekel">
    <div id="form-block">
      <h2>Érdekel? Légy az elsők között!</h2>
      <p class="lead">Add meg az e-mail-címed, és értesítünk, amint elindulunk.
        <i>Intéressé? Laissez votre e-mail pour être parmi les premiers. · Interested? Leave your email to be among the first.</i>
      </p>
      <form id="waitlist-form" novalidate>
        <div class="field">
          <label for="wl-email">E-mail-cím</label>
          <input id="wl-email" name="email" type="email" required autocomplete="email" placeholder="pl. anna@example.hu" inputmode="email">
        </div>
        <div class="field">
          <label for="wl-interest">Melyik nyelven olvasnád? / Langue / Language</label>
          <select id="wl-interest" name="interest">
            <option value="hu" selected>Magyar</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
        <div class="hp" aria-hidden="true">
          <label for="wl-website">Website</label>
          <input id="wl-website" name="website" type="text" tabindex="-1" autocomplete="off">
        </div>
        <button class="btn" type="submit" id="wl-submit">Érdekel — feliratkozom</button>
        <div class="form-msg" id="form-msg" role="alert" aria-live="polite"></div>
      </form>
      <p class="privacy">Az e-mail-címedet kizárólag az indulásról szóló értesítésre használjuk.</p>
    </div>

    <div class="thanks" id="thanks">
      <h3>Köszönjük!</h3>
      <p>Felírtunk a listára — hamarosan jelentkezünk.<br>
      <i>Merci ! On vous contactera bientôt. · Thank you! We will be in touch soon.</i></p>
      <div class="sig">Szeretettel, a Családi napló csapata</div>
    </div>
  </section>

</div>

<footer class="site-footer">
  <div class="masthead-h">
    <span class="masthead-h__word">Család napló</span>
    <span class="masthead-h__sub">csaladinaplo.hu</span>
  </div>
  <div class="site-footer__copy">© 2026 MTB Retail Kft. · Budapest · info@csaladinaplo.hu</div>
  <a href="/back-office" class="site-footer__secret">admin</a>
</footer>

<script>
(function () {
  var API_BASE = /csaladinaplo-api/.test(location.host) ? '' : 'https://csaladinaplo-api.joelle-marquie.workers.dev';
  var form = document.getElementById('waitlist-form');
  var msg = document.getElementById('form-msg');
  var btn = document.getElementById('wl-submit');
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = document.getElementById('wl-email').value.trim();
    var interest = document.getElementById('wl-interest').value;
    var website = document.getElementById('wl-website').value;
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email)) {
      msg.textContent = 'Kérjük, érvényes e-mail-címet adj meg. / Merci d'indiquer un e-mail valide.';
      return;
    }
    msg.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Küldés…';
    fetch(API_BASE + '/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email, interest: interest, website: website })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data && res.data.ok) {
          document.getElementById('form-block').style.display = 'none';
          document.getElementById('thanks').classList.add('show');
        } else {
          throw new Error((res.data && res.data.error) || 'submit_failed');
        }
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'Érdekel — feliratkozom';
        msg.textContent = 'Hiba történt — kérjük, próbáld újra kicsit később. / Une erreur est survenue, merci de réessayer.';
      });
  });
})();
</script>
</body>
</html>
`;


async function handleApi(request, env, url) {
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();

  if (path === '/api/health') {
    return json({ ok: true, service: 'csaladinaplo-api', db: !!env.DB, time: new Date().toISOString() });
  }

  if (!env.DB) return bad('db_binding_missing (ajoute le binding D1 "DB")', 500);

  // POST /api/join  { code, email?, name?, language? }  → valide un code + (option) inscrit le membre & email de bienvenue
  if (path === '/api/join' && method === 'POST') {
    const body = await readJson(request);
    const code = (body.code || '').trim().toUpperCase();
    if (!code) return bad('code_required');
    const fam = await env.DB
      .prepare(`SELECT f.id, f.name, f.surname, f.code, r.name AS recipient, r.nick, r.city, r.country, r.language
                FROM family f LEFT JOIN recipient r ON r.id = f.recipient_id
                WHERE f.code = ?1`)
      .bind(code).first();
    if (!fam) return bad('family_not_found', 404);
    let mail = null;
    if (body.email) {
      try {
        await env.DB.prepare(`INSERT INTO user (family_id, name, email, role) VALUES (?1,?2,?3,'member')`)
          .bind(fam.id, body.name || null, body.email).run();
      } catch (_) { /* doublon email toléré */ }
      mail = await sendWelcome(env, body.email, body.name, body.language || fam.language || 'hu', code);
    }
    return json({ ok: true, family: fam, mail });
  }

  // POST /api/family/create  { recipient:{name,nick?,relation?,birth?,nameday?,language?,street?,postcode?,city?,country?},
  //                            manager:{name,email}, surname?, familyName? }  → crée destinataire+famille+manager, renvoie le code
  if (path === '/api/family/create' && method === 'POST') {
    const b = await readJson(request);
    const r = b.recipient || {};
    const m = b.manager || {};
    if (!r.name || !m.email) return bad('missing_fields (recipient.name, manager.email)');
    const lang = r.language || 'hu';
    const recIns = await env.DB
      .prepare(`INSERT INTO recipient (name,nick,relation,birth,nameday,language,street,postcode,city,country)
                VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`)
      .bind(r.name, r.nick || null, r.relation || null, r.birth || null, r.nameday || null, lang,
            r.street || null, r.postcode || null, r.city || null, r.country || null).run();
    const recipientId = recIns.meta.last_row_id;
    const surname = b.surname || r.name.split(' ')[0];
    const code = await genFamilyCode(env, surname);
    const famName = b.familyName || `${surname} család`;
    const famIns = await env.DB
      .prepare(`INSERT INTO family (name,surname,code,recipient_id) VALUES (?1,?2,?3,?4)`)
      .bind(famName, surname, code, recipientId).run();
    const familyId = famIns.meta.last_row_id;
    await env.DB.prepare(`INSERT INTO user (family_id,name,email,role) VALUES (?1,?2,?3,'manager')`)
      .bind(familyId, m.name || null, m.email).run();
    const mail = await sendWelcome(env, m.email, m.name, lang, code);
    return json({ ok: true, family_id: familyId, code, family_name: famName, mail }, 201);
  }

  // /api/posts  → GET (liste) | POST (création)
  if (path === '/api/posts') {
    if (method === 'GET') {
      const familyId = url.searchParams.get('family');
      if (!familyId) return bad('family_param_required');
      const { results } = await env.DB
        .prepare(`SELECT p.*, u.name AS author FROM post p LEFT JOIN user u ON u.id = p.author_user_id
                  WHERE p.family_id = ?1 ORDER BY p.created_at DESC LIMIT 100`)
        .bind(familyId).all();
      return json({ ok: true, posts: results });
    }
    if (method === 'POST') {
      const b = await readJson(request);
      if (!b.family_id || !b.text) return bad('family_id_and_text_required');
      const res = await env.DB
        .prepare(`INSERT INTO post (family_id, author_user_id, text, img_key, family_only, meta_date, meta_time, meta_place)
                  VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`)
        .bind(b.family_id, b.author_user_id || null, b.text, b.img_key || null,
              b.family_only ? 1 : 0, b.meta_date || null, b.meta_time || null, b.meta_place || null)
        .run();
      return json({ ok: true, id: res.meta.last_row_id }, 201);
    }
    return bad('method_not_allowed', 405);
  }

  // GET /api/journal?family=CODE|ID&from=YYYY-MM-DD&to=YYYY-MM-DD&month=YYYY-MM
  // → données prêtes pour renderJournal() (journal/journal-template.js).
  //   Images : env.IMG_BASE (URL publique R2) + post.img_key.
  if (path === '/api/journal' && method === 'GET') {
    const famParam = (url.searchParams.get('family') || '').trim();
    if (!famParam) return bad('family_param_required');
    const byId = /^\d+$/.test(famParam);
    const fam = await env.DB.prepare(
      `SELECT f.id, f.name, f.surname, f.code,
              r.name AS r_name, r.nick AS r_nick, r.city AS r_city, r.birth AS r_birth, r.nameday AS r_nameday
         FROM family f LEFT JOIN recipient r ON r.id = f.recipient_id
        WHERE ${byId ? 'f.id = ?1' : 'f.code = ?1'}`)
      .bind(byId ? Number(famParam) : famParam.toUpperCase()).first();
    if (!fam) return bad('family_not_found', 404);

    const monthParam = url.searchParams.get('month'); // "2026-06"
    const now = new Date();
    const year = monthParam ? Number(monthParam.split('-')[0]) : now.getUTCFullYear();
    const month = monthParam ? Number(monthParam.split('-')[1]) : now.getUTCMonth() + 1;
    const defFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const defTo = `${year}-${String(month).padStart(2, '0')}-31`;
    const from = url.searchParams.get('from') || defFrom;
    const to = url.searchParams.get('to') || defTo;

    const { results } = await env.DB.prepare(
      `SELECT p.*, u.name AS author
         FROM post p LEFT JOIN user u ON u.id = p.author_user_id
        WHERE p.family_id = ?1
          AND COALESCE(p.meta_date, substr(p.created_at,1,10)) BETWEEN ?2 AND ?3
        ORDER BY COALESCE(p.meta_date, substr(p.created_at,1,10)) DESC
        LIMIT 100`).bind(fam.id, from, to).all();

    const imgBase = (env.IMG_BASE || '').replace(/\/?$/, '/');
    const deriveTitle = (t) => {
      const s = String(t || '').trim();
      const first = (s.split(/(?<=[.!?])\s/)[0] || s).trim();
      return first.length > 60 ? first.slice(0, 57).replace(/\s+\S*$/, '') + '…' : first;
    };
    const posts = (results || []).map((p) => ({
      author: p.author || 'A család',
      title: deriveTitle(p.text),
      text: p.text || '',
      img: p.img_key ? (env.IMG_BASE ? imgBase + p.img_key : null) : null,
      date: p.meta_date || (p.created_at || '').slice(0, 10),
      place: p.meta_place || '',
      familyOnly: !!p.family_only,
    }));

    const HU_SHORT = ['jan.','febr.','márc.','ápr.','máj.','jún.','júl.','aug.','szept.','okt.','nov.','dec.'];
    const birthdays = [], namedays = [];
    if (fam.r_birth) {
      const [by, bm, bd] = String(fam.r_birth).split('-').map(Number);
      if (bm === month || bm === (month % 12) + 1) {
        birthdays.push({ name: fam.r_nick || fam.r_name, date: `${HU_SHORT[bm - 1]} ${bd}.`, age: year - by });
      }
    }
    if (fam.r_nameday) namedays.push({ name: fam.r_nick || fam.r_name, date: fam.r_nameday });

    const data = {
      issue: { year, month, number: Math.max(1, (year - 2025) * 12 + month - 8) },
      family: { surname: fam.surname || (fam.name || '').replace(/ család$/, '') },
      recipient: { name: fam.r_name || '', nick: fam.r_nick || undefined, city: fam.r_city || '' },
      posts, birthdays, namedays,
      games: { riddles: [] },
      message: '',
    };
    return json({ ok: true, data, meta: { family_id: fam.id, code: fam.code, from, to, post_count: posts.length } });
  }

  // POST /api/subscribe  { family_id, zone, frequency, amount?, currency?, buyer?, itemName?, language? }
  // Crée l'abonnement (pending). Si buyer + clé Számlázz → émet un díjbekérő et renvoie le lien Barion (payment.payUrl).
  if (path === '/api/subscribe' && method === 'POST') {
    const b = await readJson(request);
    if (!b.family_id || !b.zone || !b.frequency) return bad('missing_fields');
    const currency = b.currency || (b.zone === 'eu' ? 'EUR' : 'HUF');
    const res = await env.DB
      .prepare(`INSERT INTO subscription (family_id, zone, frequency, currency, amount, status)
                VALUES (?1,?2,?3,?4,?5,'pending')`)
      .bind(b.family_id, b.zone, b.frequency, currency, b.amount || null).run();
    const subscriptionId = res.meta.last_row_id;
    let payment = null;
    if (b.buyer && b.buyer.email && env.SZAMLAZZ_AGENT_KEY) {
      try {
        const gross = Number(b.amount) || 0;
        // ÁFA : HU = 27% ; UE = TVA OSS du pays destinataire (à affiner avec la compta) → AAM/0 en attendant.
        const vatRate = b.zone === 'hu' ? 27 : 0;
        const net = vatRate ? Math.round(gross / (1 + vatRate / 100)) : gross;
        const item = { name: b.itemName || `Családi napló előfizetés (${b.frequency})`, qty: 1, unit: 'db',
          netUnit: net, vat: vatRate ? String(vatRate) : 'AAM', net, vatAmount: gross - net, gross };
        const dij = await szamlazzDijbekero(env, {
          orderNumber: `CLN-SUB-${subscriptionId}`, currency, language: b.language || 'hu',
          buyer: b.buyer, items: [item], dueDays: 8,
          emailSubject: 'Családi napló — díjbekérő', emailBody: 'Köszönjük az előfizetést! A fizetéshez kattints a linkre.',
        });
        payment = { ok: dij.ok, payUrl: dij.payUrl || '', invoiceNumber: dij.invoiceNumber || '',
          error: dij.errorMessage || '', errorCode: dij.errorCode || '' };
      } catch (err) { payment = { ok: false, error: String(err) }; }
    }
    return json({ ok: true, subscription_id: subscriptionId, status: 'pending', payment }, 201);
  }

  // POST /api/payment/callback  (IPN Barion/Számlázz) { subscription_id, status, payment_id?, amount?, currency?, email?, lang?, plan? }
  // status « succeeded/paid/active » → abonnement actif + paiement enregistré + email de confirmation.
  if (path === '/api/payment/callback' && method === 'POST') {
    const b = await readJson(request);
    const subId = b.subscription_id || b.subscriptionId;
    const status = String(b.status || '').toLowerCase();
    const succeeded = ['succeeded', 'success', 'paid', 'completed', 'active'].includes(status);
    let updated = false, mail = null;
    if (subId && succeeded) {
      try {
        await env.DB.prepare(`UPDATE subscription SET status='active' WHERE id=?1`).bind(subId).run();
        await env.DB.prepare(`INSERT INTO payment (subscription_id, provider, provider_payment_id, amount, currency, status, type)
                              VALUES (?1,'barion',?2,?3,?4,'succeeded','initial')`)
          .bind(subId, b.payment_id || null, b.amount || null, b.currency || null).run();
        updated = true;
      } catch (_) { /* best-effort / idempotence */ }
      if (env.BREVO_API_KEY) {
        let email = b.email, lang = b.lang;
        if (!email) {
          const row = await env.DB.prepare(
            `SELECT u.email AS email, r.language AS language
               FROM subscription s JOIN family f ON f.id = s.family_id
               LEFT JOIN user u ON u.family_id = f.id AND u.role IN ('manager','payer')
               LEFT JOIN recipient r ON r.id = f.recipient_id
              WHERE s.id = ?1 LIMIT 1`).bind(subId).first();
          if (row) { email = email || row.email; lang = lang || row.language; }
        }
        if (email) {
          try {
            const e = lifecycleEmail('payment', lang || 'hu', { plan: b.plan, amount: b.amount, currency: b.currency });
            mail = await brevoSendEmail(env, { to: [{ email }], subject: e.subject, htmlContent: e.htmlContent });
          } catch (err) { mail = { ok: false, error: String(err) }; }
        }
      }
    }
    return json({ ok: true, received: true, updated, mail });
  }

  // --- Számlázz : test de la clé Agent (lecture seule, AUCUN effet de bord) ---
  // GET/POST /api/szamlazz/check
  if (path === '/api/szamlazz/check') {
    if (!env.SZAMLAZZ_AGENT_KEY) return bad('szamlazz_key_missing (ajoute le secret SZAMLAZZ_AGENT_KEY)', 500);
    return json({ ok: true, check: await szamlazzCheck(env) });
  }

  // --- Számlázz : émettre un díjbekérő (proforma) avec lien de paiement Barion ---
  // POST /api/szamlazz/dijbekero { orderNumber, buyer:{name,zip,city,address,email,country?,taxNumber?},
  //                                items:[{name,qty,unit,netUnit,vat,net,vatAmount,gross}],
  //                                currency?, paymentMethod?, note?, dueDays?, emailSubject?, emailBody?, replyTo? }
  if (path === '/api/szamlazz/dijbekero' && method === 'POST') {
    if (!env.SZAMLAZZ_AGENT_KEY) return bad('szamlazz_key_missing', 500);
    const b = await readJson(request);
    if (!b.orderNumber || !b.buyer || !b.buyer.email || !Array.isArray(b.items) || !b.items.length) {
      return bad('missing_fields (orderNumber, buyer.email, items[])');
    }
    const r = await szamlazzDijbekero(env, b);
    return json({ ok: r.ok, invoice: r }, r.ok ? 201 : 502);
  }

  // --- Brevo : test (upsert contact + email de bienvenue) ---
  // POST /api/brevo/test { email, name? }
  if (path === '/api/brevo/test' && method === 'POST') {
    if (!env.BREVO_API_KEY) return bad('brevo_key_missing (ajoute le secret BREVO_API_KEY)', 500);
    const b = await readJson(request);
    if (!b.email) return bad('email_required');
    const contact = await brevoUpsertContact(env, { email: b.email, attributes: { VEZETEKNEV: b.name || '' } });
    const email = await brevoSendEmail(env, {
      to: [{ email: b.email, name: b.name || '' }],
      subject: 'Üdvözlünk a Családi naplónál! 🌼',
      htmlContent: `<div style="font-family:Georgia,serif;color:#241a10">
        <h2 style="color:#bc5e22">Üdvözlünk a Családi naplónál!</h2>
        <p>Köszönjük, hogy csatlakoztál. Hamarosan elindíthatod a család közös naplóját,
        amelyből rendszeresen nyomtatott újság készül a nagyinak. 💛</p>
        <p style="color:#7c6451">— A Családi napló csapata · csaladinaplo.hu</p></div>`,
    });
    return json({ ok: contact.ok && email.ok, contact, email });
  }

  // --- Brevo : upsert contact (à appeler à l'inscription depuis le front/worker) ---
  // POST /api/brevo/contact { email, attributes? , listIds? }
  if (path === '/api/brevo/contact' && method === 'POST') {
    if (!env.BREVO_API_KEY) return bad('brevo_key_missing', 500);
    const b = await readJson(request);
    if (!b.email) return bad('email_required');
    return json(await brevoUpsertContact(env, b));
  }

  return bad('not_found', 404);
}

/* ===================== Számlázz.hu — Számla Agent (Phase 3) =====================
 * POST multipart vers https://www.szamlazz.hu/szamla/ ; le NOM du champ choisit l'action.
 * Auth = <szamlaagentkulcs> (minuscules) dans <beallitasok>. Díjbekérő = <dijbekero>true</dijbekero>.
 * Lien de paiement Barion renvoyé dans le header `szlahu_vevoifiokurl` (+ <vevoifiokurl> en valaszVerzio=2).
 * Erreurs : headers `szlahu_error_code` + `szlahu_error`. */
const SZ_URL = 'https://www.szamlazz.hu/szamla/';
const xesc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const ymd = (d) => d.toISOString().slice(0, 10);

function buildDijbekeroXml(env, o) {
  const today = new Date();
  const due = new Date(today.getTime() + (o.dueDays || 8) * 86400000);
  const items = o.items.map((it) => `
    <tetel>
      <megnevezes>${xesc(it.name)}</megnevezes>
      <mennyiseg>${it.qty}</mennyiseg>
      <mennyisegiEgyseg>${xesc(it.unit || 'db')}</mennyisegiEgyseg>
      <nettoEgysegar>${it.netUnit}</nettoEgysegar>
      <afakulcs>${it.vat}</afakulcs>
      <nettoErtek>${it.net}</nettoErtek>
      <afaErtek>${it.vatAmount}</afaErtek>
      <bruttoErtek>${it.gross}</bruttoErtek>
    </tetel>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${xesc(env.SZAMLAZZ_AGENT_KEY)}</szamlaagentkulcs>
    <eszamla>true</eszamla>
    <szamlaLetoltes>false</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
  </beallitasok>
  <fejlec>
    <keltDatum>${ymd(today)}</keltDatum>
    <teljesitesDatum>${ymd(today)}</teljesitesDatum>
    <fizetesiHataridoDatum>${ymd(due)}</fizetesiHataridoDatum>
    <fizmod>${xesc(o.paymentMethod || 'Bankkártya')}</fizmod>
    <penznem>${xesc(o.currency || 'HUF')}</penznem>
    <szamlaNyelve>${xesc(o.language || 'hu')}</szamlaNyelve>
    <megjegyzes>${xesc(o.note || '')}</megjegyzes>
    <rendelesSzam>${xesc(o.orderNumber)}</rendelesSzam>
    <dijbekero>true</dijbekero>${o.prefix ? `
    <szamlaszamElotag>${xesc(o.prefix)}</szamlaszamElotag>` : ''}
  </fejlec>
  <elado>
    <emailReplyto>${xesc(o.replyTo || '')}</emailReplyto>
    <emailTargy>${xesc(o.emailSubject || '')}</emailTargy>
    <emailSzoveg>${xesc(o.emailBody || '')}</emailSzoveg>
  </elado>
  <vevo>
    <nev>${xesc(o.buyer.name || '')}</nev>
    <orszag>${xesc(o.buyer.country || '')}</orszag>
    <irsz>${xesc(o.buyer.zip || '')}</irsz>
    <telepules>${xesc(o.buyer.city || '')}</telepules>
    <cim>${xesc(o.buyer.address || '')}</cim>
    <email>${xesc(o.buyer.email)}</email>
    <sendEmail>true</sendEmail>
    <adoszam>${xesc(o.buyer.taxNumber || '')}</adoszam>
  </vevo>
  <tetelek>${items}
  </tetelek>
</xmlszamla>`;
}

async function szPost(field, xml, filename) {
  const form = new FormData();
  form.append(field, new Blob([xml], { type: 'application/xml' }), filename);
  const res = await fetch(SZ_URL, { method: 'POST', body: form });
  const h = res.headers;
  return {
    errorCode: h.get('szlahu_error_code') || '',
    errorMessage: decodeURIComponent(h.get('szlahu_error') || ''),
    invoiceNumber: decodeURIComponent(h.get('szlahu_szamlaszam') || ''),
    payUrl: h.get('szlahu_vevoifiokurl') || '',
    net: h.get('szlahu_nettovegosszeg') || '',
    gross: h.get('szlahu_bruttovegosszeg') || '',
    httpStatus: res.status,
  };
}

// Díjbekérő : crée la proforma + envoie l'email au client (avec lien Barion).
async function szamlazzDijbekero(env, o) {
  const r = await szPost('action-xmlagentxmlfile', buildDijbekeroXml(env, o), 'dijbekero.xml');
  return { ok: !r.errorCode, ...r };
}

// Test clé Agent SANS effet de bord : on interroge une commande inexistante.
// « facture introuvable » => clé VALIDE ; erreur d'auth => clé INVALIDE.
async function szamlazzCheck(env) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlaxml xmlns="http://www.szamlazz.hu/xmlszamlaxml">
  <szamlaagentkulcs>${xesc(env.SZAMLAZZ_AGENT_KEY)}</szamlaagentkulcs>
  <szamlaszam></szamlaszam>
  <rendelesSzam>HEALTHCHECK-${Date.now()}</rendelesSzam>
  <pdf>false</pdf>
  <szamlaKulsoAzon></szamlaKulsoAzon>
</xmlszamlaxml>`;
  const r = await szPost('action-szamla_agent_xml', xml, 'query.xml');
  // Heuristique : un message « nincs ilyen / nem található » = clé OK (commande absente),
  // un code lié à l'authentification = clé KO.
  const txt = (r.errorMessage || '').toLowerCase();
  const looksAuth = /agent|kulcs|jogosultság|authentic|belépés|hibás felhasználó/.test(txt);
  return {
    keyValid: !looksAuth,            // best-effort (voir errorMessage pour trancher)
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
    httpStatus: r.httpStatus,
  };
}
/* =============================================================================== */

/* ===================== Brevo (ex-Sendinblue) — emails cycle de vie (Phase 5) =====
 * API v3, header `api-key: BREVO_API_KEY`. UE (RGPD-friendly).
 * - upsert contact : POST /v3/contacts  (updateEnabled:true)
 * - email transactionnel : POST /v3/smtp/email (templateId+params OU subject+htmlContent)
 * Flux : inscription → upsert + bienvenue ; paiement → confirmation ; Cron → rappel avant publication. */
const BREVO_API = 'https://api.brevo.com/v3';
async function brevoFetch(env, path, body) {
  const res = await fetch(BREVO_API + path, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  let data; const txt = await res.text();
  try { data = txt ? JSON.parse(txt) : {}; } catch { data = txt; }
  return { ok: res.ok, status: res.status, data };
}
async function brevoUpsertContact(env, c) {
  return brevoFetch(env, '/contacts', {
    email: c.email,
    attributes: c.attributes || {},
    listIds: c.listIds || undefined,
    updateEnabled: true,
  });
}
async function brevoSendEmail(env, m) {
  const sender = m.sender || { name: 'Családi napló', email: 'info@csaladinaplo.hu' };
  const payload = m.templateId
    ? { sender, to: m.to, templateId: m.templateId, params: m.params || {} }
    : { sender, to: m.to, subject: m.subject, htmlContent: m.htmlContent };
  return brevoFetch(env, '/smtp/email', payload);
}

/* --- Inscription : upsert contact + email de bienvenue (best-effort, n'empêche jamais la création) --- */
async function sendWelcome(env, email, name, lang, code) {
  if (!env.BREVO_API_KEY) return null;
  try {
    await brevoUpsertContact(env, {
      email, attributes: { PRENOM: name || '', LANG: lang, CODE: code || '' },
      listIds: env.BREVO_LIST_ID ? [Number(env.BREVO_LIST_ID)] : undefined,
    });
    const e = lifecycleEmail('welcome', lang, { name, code });
    return await brevoSendEmail(env, { to: [{ email, name: name || '' }], subject: e.subject, htmlContent: e.htmlContent });
  } catch (err) { return { ok: false, error: String(err) }; }
}

/* --- Génère un code famille unique : préfixe ASCII du nom + 4 chiffres (ex. KOV-7821) --- */
function asciiPrefix(s) {
  const p = String(s || '').normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3);
  return p || 'CSN';
}
async function genFamilyCode(env, surname) {
  const pre = asciiPrefix(surname);
  for (let i = 0; i < 8; i++) {
    const code = `${pre}-${Math.floor(1000 + Math.random() * 9000)}`;
    const ex = await env.DB.prepare('SELECT 1 FROM family WHERE code = ?1').bind(code).first();
    if (!ex) return code;
  }
  return `${pre}-${String(Date.now()).slice(-5)}`;
}

/* --- Emails de cycle de vie (HU/FR/EN) : welcome | payment | reminder --- */
const MAIL_FOOTER = {
  hu: '— A Családi napló csapata · csaladinaplo.hu',
  fr: '— L’équipe Családi napló · csaladinaplo.hu',
  en: '— The Családi napló team · csaladinaplo.hu',
};
function mailShell(bodyHtml, lang) {
  return `<div style="font-family:Georgia,serif;color:#241a10;max-width:560px;margin:0 auto;line-height:1.5">
${bodyHtml}
<p style="color:#7c6451;margin-top:24px">${MAIL_FOOTER[lang] || MAIL_FOOTER.hu}</p></div>`;
}
function lifecycleEmail(kind, lang0, d = {}) {
  const lang = ['hu', 'fr', 'en'].includes(lang0) ? lang0 : 'hu';
  const nm = d.name ? ' ' + d.name : '';
  if (kind === 'welcome') {
    const S = { hu: 'Üdvözlünk a Családi naplónál! 🌼', fr: 'Bienvenue sur Családi napló ! 🌼', en: 'Welcome to Családi napló! 🌼' };
    const B = {
      hu: `<h2 style="color:#bc5e22">Üdvözlünk${nm}!</h2><p>Köszönjük, hogy csatlakoztál a Családi naplóhoz. A család közös bejegyzéseiből rendszeresen <strong>nyomtatott újság</strong> készül, amelyet postán küldünk a nagyinak. 💛</p>${d.code ? `<p>Családi kód: <strong>${d.code}</strong> — oszd meg a rokonokkal!</p>` : ''}`,
      fr: `<h2 style="color:#bc5e22">Bienvenue${nm} !</h2><p>Merci d’avoir rejoint Családi napló. Les publications de la famille deviennent un <strong>journal imprimé</strong> envoyé régulièrement par la poste à l’aîné. 💛</p>${d.code ? `<p>Code famille : <strong>${d.code}</strong> — partage-le avec tes proches !</p>` : ''}`,
      en: `<h2 style="color:#bc5e22">Welcome${nm}!</h2><p>Thanks for joining Családi napló. The family’s posts become a <strong>printed newspaper</strong> mailed regularly to grandma. 💛</p>${d.code ? `<p>Family code: <strong>${d.code}</strong> — share it with your relatives!</p>` : ''}`,
    };
    return { subject: S[lang], htmlContent: mailShell(B[lang], lang) };
  }
  if (kind === 'payment') {
    const S = { hu: 'Sikeres előfizetés — Családi napló ✅', fr: 'Abonnement confirmé — Családi napló ✅', en: 'Subscription confirmed — Családi napló ✅' };
    const amt = d.amount != null ? `${d.amount} ${d.currency || ''}`.trim() : '';
    const B = {
      hu: `<h2 style="color:#bc5e22">Köszönjük az előfizetést!</h2><p>Az előfizetésed aktív${d.plan ? ` (<strong>${d.plan}</strong>)` : ''}${amt ? ` — ${amt}` : ''}. A következő lapszámot hamarosan nyomtatjuk és postázzuk. 💛</p>`,
      fr: `<h2 style="color:#bc5e22">Merci pour ton abonnement !</h2><p>Ton abonnement est actif${d.plan ? ` (<strong>${d.plan}</strong>)` : ''}${amt ? ` — ${amt}` : ''}. Le prochain numéro sera bientôt imprimé et posté. 💛</p>`,
      en: `<h2 style="color:#bc5e22">Thank you for subscribing!</h2><p>Your subscription is active${d.plan ? ` (<strong>${d.plan}</strong>)` : ''}${amt ? ` — ${amt}` : ''}. The next issue will be printed and mailed soon. 💛</p>`,
    };
    return { subject: S[lang], htmlContent: mailShell(B[lang], lang) };
  }
  // kind === 'reminder' — rappel avant la clôture du numéro mensuel
  const S = {
    hu: 'Emlékeztető: hamarosan zárul a havi újság ✍️',
    fr: 'Rappel : le journal du mois est bientôt bouclé ✍️',
    en: 'Reminder: this month’s journal closes soon ✍️',
  };
  const B = {
    hu: `<h2 style="color:#bc5e22">Ne maradj le${nm}!</h2><p>Hamarosan lezárjuk a havi lapszámot${d.deadline ? ` (<strong>${d.deadline}</strong>)` : ''}. Tölts fel még egy-két képet vagy történetet, hogy a nagyi újságja tele legyen élettel! 📷</p>`,
    fr: `<h2 style="color:#bc5e22">Ne rate pas le numéro${nm} !</h2><p>Le journal du mois sera bientôt bouclé${d.deadline ? ` (<strong>${d.deadline}</strong>)` : ''}. Ajoute encore une photo ou une histoire pour remplir le journal de l’aîné ! 📷</p>`,
    en: `<h2 style="color:#bc5e22">Don’t miss this issue${nm}!</h2><p>The monthly journal closes soon${d.deadline ? ` (<strong>${d.deadline}</strong>)` : ''}. Add one more photo or story to fill grandma’s newspaper! 📷</p>`,
  };
  return { subject: S[lang], htmlContent: mailShell(B[lang], lang) };
}

/* --- Cron (scheduled) : rappel aux membres 3 jours avant la fin du mois (best-effort) --- */
async function runReminders(env) {
  if (!env.DB || !env.BREVO_API_KEY) return { ok: false, skipped: 'db_or_brevo_missing' };
  const now = new Date();
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  if (lastDay - now.getUTCDate() !== 3) return { ok: true, skipped: 'not_reminder_day' };
  const deadline = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${lastDay}`;
  const { results } = await env.DB.prepare(
    `SELECT u.email, u.name, COALESCE(r.language, 'hu') AS language
       FROM user u JOIN family f ON f.id = u.family_id
       LEFT JOIN recipient r ON r.id = f.recipient_id
      WHERE u.email IS NOT NULL AND u.email <> ''`).all();
  let sent = 0;
  for (const u of results || []) {
    try {
      const e = lifecycleEmail('reminder', u.language, { name: u.name, deadline });
      const r = await brevoSendEmail(env, { to: [{ email: u.email, name: u.name || '' }], subject: e.subject, htmlContent: e.htmlContent });
      if (r.ok) sent++;
    } catch (_) { /* best-effort */ }
  }
  return { ok: true, sent };
}

/* --- Lecture sûre du corps JSON d'une requête --- */
async function readJson(request) {
  try { return (await request.json()) || {}; } catch { return {}; }
}
