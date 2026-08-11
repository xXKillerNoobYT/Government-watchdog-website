# Hosting options review — Government Watchdog (2026-08-11)

**Prepared by:** backend Tom (`claude_backendtom_01`) @ Mac.home.local, at Isaac's request ("just looking into options for the hosting platform").
**Status:** research + analysis only. **The pick is owner-gated** — it is recurring spend, a public front door, and DNS. Nothing here changes GOV-1552.
**Sources read:** `docs/gov1543-deploy-execution-plan.md` (the July-2026 costing), `docs/deployment-sites.md` (the live Sites deployment), `docs/gov1552-ux-golive-acceptance-checklist.md` (recovered and merged today as `86fe7e4`).

---

## 1. The constraint is the ARCHITECTURE, not preference

From the Phase-1 pinned-artifact contract (`gov1543` §1) — **one deployment unit, two processes, exactly one reachable from the internet**:

```
internet :443 → edge web server (Caddy/nginx)
                 ├─ serves dist/ (static: landing, app shell, published.json — honestly empty until P8)
                 └─ reverse-proxies /api/* → 127.0.0.1:$GW_SERVICE_PORT
                                              service/run.py   ← LOOPBACK ONLY
                                              (ALLOWED_BIND_HOSTS guard refuses anything else)
                                                    └─ /data/gw.db  (persistent volume, SQLite)
```

**Any candidate host must therefore provide all four:**

| # | Requirement | Why it is hard to drop |
|---|---|---|
| R1 | Run a **long-lived Python process** (`service/run.py`) | It is the API. Not a build step, not a function. |
| R2 | **Persistent volume** for `/data/gw.db` | SQLite. Ephemeral filesystems lose accounts/waitlist between deploys. |
| R3 | **Build-time secret** for the private-repo artifact fetch (`GW_BACKEND_DEPLOY_TOKEN`) | The backend artifact comes from a private repo at build time. |
| R4 | **No forced public port exposure** — only the edge port is routed | The `ALLOWED_BIND_HOSTS` guard *refuses to start* if the service is bound publicly. Fail-closed by design. |

Plus: custom domain + TLS, and **≤ $15/mo** default cap.

**This is what excludes pure static hosts** (GitHub Pages, Cloudflare Pages, Netlify/Vercel static tiers): they satisfy none of R1–R2. It is not a taste question.

---

## 2. What was already costed, and why Fly was recommended (July 2026)

`gov1543` §2 — *"All three candidates satisfy the required shape … pick deferred to the P3d card."*

| Platform | Shape | Est. / mo | Stated reason |
|---|---|---|---|
| **Fly.io** *(CTO-recommended)* | one `shared-cpu-1x` machine (edge + loopback service **in one VM**) + 1 GB volume | **~$5–8** | *"the most direct match to the loopback contract"*; machine-level control; scale fixed at 1; volume snapshots built in |
| **Render** | Web Service (Starter), edge+service, static from same service | **~$7** | fixed price; simplest dashboard; disk add-on for SQLite. **No separate cap setting exists — the fixed price IS the cap** |
| **Railway** | Hobby, single service + volume | **~$5–10** | $5 base + usage; **requires** setting the usage cap to $15 |

**Fly won on architectural fit** — both processes in one VM is the literal shape of the loopback contract. Render wins on *predictability* (fixed $7, no usage surprise). Railway is the most exposed to usage drift.

---

## 3. ⭐ OpenAI **Sites** — the option already in production, and mostly overlooked

**Government Watchdog is ALREADY hosted on Sites right now** (`docs/deployment-sites.md`):

- **Live URL:** `https://alpine-government-watchdog-beta.weirdtoocompany.chatgpt.site/`
- **Binding:** `.openai/hosting.json` (opaque project ID — reuse it, never create a second project)
- **Access:** `custom` / private beta · **Custom domain: none**
- **Sites is the authentication boundary** — its `custom` access policy admits the approved owner *before* any owner-only static root or asset is served
- **It is NOT purely static:** Sites dispatches through a server-side worker `dist/server/index.js`, which reads the platform header `oai-authenticated-user-email` **server-side only** and compares against `GW_APPROVED_REVIEWER_EMAILS` (Sites runtime env). Missing config → `503`; non-allowlisted → non-enumerating `403`; responses private/no-store/noindex.

### What that means against R1–R4

| Req | Sites | Confidence |
|---|---|---|
| R1 long-lived **Python** process | ❌ Worker model is JS (`dist/server/index.js`), not an arbitrary Python daemon | High — the doc describes a worker, not a VM |
| R2 persistent volume / SQLite | ❌ No volume documented; worker runtimes are ordinarily ephemeral | **Medium — NOT VERIFIED, see §5** |
| R3 build-time secret | ⚠️ Runtime env exists (`GW_APPROVED_REVIEWER_EMAILS`); build-time token unclear | **Medium — NOT VERIFIED** |
| R4 no public port exposure | ✅ Platform-managed; nothing binds publicly | High |
| Custom domain | ⚠️ Currently `none`; support unknown | **NOT VERIFIED** |
| Cost | ✅ Included in the existing ChatGPT plan — **$0 incremental** | High |

---

## 4. 🔑 The question this review actually surfaces

**At P3e go-live, all three flags stay OFF and the published lane stays honestly EMPTY.** Every gated route answers a constant `404`; deploying *activates nothing*.

So the paid backend, on day one, serves: static assets, `/api/health` → `{"status":"ok"}`, and a wall of deliberate `404`s.

**Sites already serves the static artifact behind a real auth boundary, at zero incremental cost.**

**Therefore the honest question is not "Fly or Render or Railway" — it is:**

> **Does the gated front door need a paid backend host *yet*, or only when the flags actually flip (waitlist, magic-link, beta accounts — i.e. when `service/run.py` and `gw.db` start doing real work)?**

Two coherent paths:

- **A — Defer the spend.** Keep the private beta on Sites (already live, $0). Take the paid host only when a flag flip is genuinely imminent. **Cost: $0 now.** Risk: the P3e UX acceptance checklist (merged today) targets `watchdog.isaac4alpine.com`, so it would need re-pointing at the Sites URL, and the custom-domain question stays open.
- **B — Deploy the backend now as planned.** Fly.io ~$5–8/mo (or Render ~$7 fixed if you prefer no usage variance). Buys: the real loopback topology, a persistent DB, a custom domain, and the acceptance checklist runs exactly as written. **Cost: ~$60–100/yr**, against a standing "no new spend until $600/mo net profit" gate.

---

## 5. What I did NOT verify (say so rather than guess)

1. **Whether Sites supports a custom domain** (`watchdog.isaac4alpine.com`). Doc says `Custom domain: none` — that records the current state, not the capability.
2. **Whether Sites offers any persistent storage.** If it does, path A gets considerably stronger.
3. **Whether the worker can host the API surface** the checklist expects (`/api/health`, `/api/beta/*` neutral).
4. **Whether Sites accepts a build-time secret** for the private-repo artifact fetch.

**Each is answerable from the Sites documentation/dashboard in minutes** — worth doing before spending, because if 1–3 come back "yes", option A may cover P3e outright.

---

## 6. ⚠️ Unrelated blocker on the same issue — the record contradicts itself

**GOV-1552 cannot be actioned by anyone until this is settled, and it is not a hosting question:**

- **Description:** owner card `08b58d66` **ACCEPTED 2026-07-24T05:50:47Z** → picks **locked**: Fly.io + `watchdog.isaac4alpine.com` + $15/mo cap.
- **Last comment (2026-08-02):** *"Blocked on owner direction. Three interaction cards rejected; Isaac must reply on GOV-1552 with which platform to use (or cancel)."*

**Both are in the record. Only Isaac knows which is current.** GOV-784 (cohort ladder Step-2 → 3 → ≤15 users) is blocked behind it.

---

## Recommendation

**Answer §5.1–5.3 first (minutes, free), then decide.** If Sites supports a custom domain and any persistent storage, **path A defers real money at no capability cost** and the private beta keeps running exactly as it does today. If it does not, **Fly.io ~$5–8/mo** remains the right pick for the reason originally given — it is the most direct match to the loopback contract — with **Render ~$7 fixed** as the choice if predictability matters more than fit.

**Either way, GOV-1552's contradiction needs one line from Isaac** before any platform work proceeds.
