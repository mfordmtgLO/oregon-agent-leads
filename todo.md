# Project TODO — Oregon Agent Leads — Mike Ford

## Auth
- [x] Custom session-based login (username: mike.ford, fixed password), no OAuth, no registration
- [x] All agent data procedures protected behind the session
- [x] Logout button

## Database & Seeding
- [x] `agents` table schema (name, brokerage, city, phone, email, website URL, Zillow URL, headshot URL, buyer-side stats, sales last 12 months, other production stats, RealTrends rank/sides/volume, notes, isCustom flag)
- [x] Seed all 60 agents from oregon_agents_data.json

## Features
- [x] Agent list with card view (headshot-prominent grid)
- [x] Agent list with table view (compact rows, sortable columns)
- [x] Sort by name, city, brokerage, RealTrends rank, total sides, volume
- [x] Search/filter by name, city, brokerage
- [x] Clickable website & Zillow links
- [x] Per-agent notes editor with save (persisted to DB)
- [x] Manual add-agent form (name, phone, email, brokerage, city, website URL, Zillow URL, headshot upload or URL, notes)
- [x] Headshot image upload to S3 storage
- [x] CSV export of full list including custom agents and notes
- [x] Agent detail view (full stats, sources)

## UI / Style
- [x] Header reads exactly "Oregon Agent Leads — Mike Ford"
- [x] Editorial magazine aesthetic: cream background, Didone serif display type, lighter serif subheads, fine geometric rules, spaced-out sans-serif details, generous negative space, asymmetrical balance
- [x] Sidebar/dashboard layout
- [x] Login page styled in the same editorial identity
- [x] Fallback avatar for agents without headshots

## Quality
- [x] Vitest unit tests (auth, agents CRUD, CSV export)
- [x] Visual verification via screenshots
- [x] Checkpoint + deploy to public URL (https://oregonleads-bqkuz5cc.manus.space, verified live: login works, 60 agents served)

## Office / Principal Broker Update (July 2026)
- [x] Review office_broker_data.json structure and match entries to agents by agent_name
- [x] Extend agents schema (or add offices table) with principal broker name/phone/email/headshot, office buyside transactions estimate, office buyside rank
- [x] Migrate schema and seed office/broker data from JSON (60 rows updated, 0 unmatched, 60 unique ranks)
- [x] Show Principal Broker section on agent card, table row, and Full Profile dialog
- [x] New Office Rankings view/tab: rank 1-60, brokerage, city, principal broker (name+headshot), est. annual buyside transactions, linked agents
- [x] Office Rankings searchable by brokerage, city, or principal broker name; sortable columns
- [x] CSV export includes new office/broker fields
- [x] Tests updated/added; checkpoint + redeploy

## Update 2: 50-state support (July 2026)

- [x] Schema: add `state` column to agents; migrate; backfill existing 60 agents with "Oregon"
- [x] Backend: agents.list, officeRankings, exportCsv accept state filter; export supports all-states option
- [x] Sidebar/header state picker listing all 50 states (Oregon default, no data added for others)
- [x] Dashboard + Office Rankings filter by selected state; empty-state message "No agents loaded yet for [State]"
- [x] Dynamic header title "[Selected State] Agent Leads — Mike Ford"
- [x] Add Agent form: state field defaulting to selected state
- [x] CSV export includes State column; exports current state's agents with all-states option
- [x] Tests updated; checkpoint + redeploy

## GitHub Sync (Aug 18, 2026)

- [x] Pull latest from GitHub main (commits: "Add protected Oregon agent sync export", "Update index.html")
- [x] Verify synced working copy matches remote, typecheck clean, 31/31 tests passing
- [x] Pull "Add sync rank totals and source profile links" (rankTotal + sourceProfileUrl/principalBrokerProfileUrl in sync export; ?agent=<id> deep link opens profile dialog)
- [x] Verify second sync: typecheck clean, 31/31 tests passing, deep link ?agent=1 opens Dirk Hmura profile
- [x] Redeploy synced build and verify live: login OK, 60 Oregon agents, 60 offices, /api/sync/agents returns 200 with rankTotal + sourceProfileUrl (401 without/with bad token), deep link opens profile
- [x] Known issue from synced code: principalBrokerProfileUrl ends in "?agent=" when the principal broker is not an agent in the list (should be null) — fixed upstream by "Harden principal broker sync links"
- [x] Pull "Harden principal broker sync links"; added server/syncExport.links.test.ts regression tests (34/34 passing)
- [x] Pull "Fix Oregon sync rank denominator" (rankTotal now max of agent count and highest rank); added rankTotal regression tests (37/37 passing)
- [x] Pull "Add principal broker records to Oregon directory sync" (broker records in sync feed + ?principalBroker= deep link + brokers merged into Agent Index)
- [x] Rewrite 3 superseded broker-link tests to match the new ?principalBroker= scheme and broker records
- [x] Fix flaky cross-file race in states.test.ts exportCsv count assertion (38/38 passing, 3 consecutive clean runs)
- [x] Fix 1: search/filter must include principal broker records (filter directoryRecords, not agents)
- [x] Fix 2: relabel broker card stats — office buyside/yr instead of "Sides '25"/"Volume '25"
- [x] Fix 3: remove inherited website/Zillow links from broker records
- [x] Fix 4: distinct rank badge for brokers ("Office No. N") so agent/office ranks don't collide; sidebar territory count reflects agents + brokers
- [x] Add vitest coverage for broker-record derivation (search inclusion, no inherited links) — 10 new tests, 48/48 passing
- [x] Verify in browser, checkpoint, and confirm live
- [x] Deploy broker-display fixes to production and verify on the live URL (bundle index-CGxrQHcY.js, Oregon · 97, office-labeled broker dialog, no inherited links)

## Update Current Top Agents (verification queue)

- [x] Schema: agent_verifications + verification_runs tables (proposed changes, status, source, evidence) + migration applied
- [x] Server: verification engine that fetches each agent's profile/brokerage page and compares brokerage + principal broker
- [x] Server: procedures — run, queue, runs, runDetail, approve, reject, ingest
- [x] Rank policy: ranks stay RealTrends 2026; recompute only when production figures change on approval
- [x] UI: "Update Current Top Agents" button with progress/result summary
- [x] UI: Needs Review queue showing on-record vs found, evidence link, approve/reject per item
- [x] Handle unverifiable results explicitly (blocked/dead page) rather than silently passing
- [x] Tests for engine comparison logic, queue procedures, and rank recompute (42 new tests, 90/90 passing)
- [x] Fixed false "blocked" verdicts (reCAPTCHA i18n strings matched in raw HTML)
- [x] Fixed false brokerage-change verdict (generic single-word name matched inside prose)
- [x] Fixed missed match for closed-up brand spellings (RE/MAX Power Pros vs REMAX PowerPros)
- [x] Clear test-run findings from the queue so Mike sees only real results
- [x] Verify Review Queue behaviour — sweep exercised live via curl on the dev server (10 agents: 4 confirmed, 6 unverified) and covered by UI-contract tests for queue fields, approve, dismiss, acknowledge, territory scoping, and the sweep itself; preview host is captcha-walled so in-browser clicking is pending live verification
- [x] Checkpoint + publish, then verify on the live URL (live login, protected routes, and ingest endpoint verified)
- [x] Research pass on 60 agents using low-credit sequential checks of existing profile URLs; 46 sources supported the roster record, while 14 were blocked, stale, or inconclusive and were conservatively left unverified
- [x] Ingest 60 findings into production run 420001; verified 60 checked agents, 0 unmatched, 46 confirmed, 14 conservatively unverified, and complete run history
- [x] Add durable monthly verification schedule ownership and status for Oregon
- [x] Add a low-credit sequential scheduled sweep covering all 60 agents plus paired principal/managing principal broker source pages
- [x] Send an owner approval reminder after each monthly run with counts and review-queue link
- [x] Add scheduled callback authentication, idempotency, and Vitest coverage (101 tests passing)
- [x] Create and verify the monthly production schedule, then checkpoint and publish (enabled task 4ENAXZJ3ExAoPXoZg5sCk7; 0 0 8 1 * * UTC; callback verified in production configuration)
- [x] Add an explicit scheduled verification path for paired principal/managing principal broker or office source pages, not only agent pages
- [x] Add a Vitest regression for duplicate monthly callback suppression within the idempotency window
- [x] Add dashboard schedule-status panel with monthly job last-run, next-run, enabled state, and approval status
- [x] Add targeted source links for the 14 inconclusive paired principal/managing principal broker records and preserve conservative verification outcomes (record-specific URLs persisted in officeDataSources; no unsupported broker changes applied)
- [x] Validate and, where needed, add record-specific targeted office/principal-broker source URLs for each of the 14 inconclusive Oregon records
- [x] Add a data-contract regression proving every intended inconclusive record resolves a broker/office source link (102 tests passing)
- [x] Define conservative LO–agent closed-transaction pairing fields, evidence rules, and review status
- [x] Research public loan-officer-side resources for directly evidenced Oregon LO–agent pairings without broad search; inspected specific Mid Oregon Lending, Hood River Mortgage, and Stepping Stone Mortgage resources and found no defensible roster pairings, so no records were fabricated or seeded
- [x] Add pairing storage, protected ingest/review procedures, and Mortgage Pairings dashboard presentation without inferring relationships; route visually verified
- [x] Add tests, validate evidence mapping, and checkpoint/publish the pairing workflow (105 tests passing before final checkpoint)
- [x] Inspect and document specific loan-officer-side public pages, or confirm none are usable, for targeted Oregon LO–agent pairing research
- [x] Add empty-state and stronger evidence-mapping coverage for the Mortgage Pairings view
- [x] Visually verify /pairings, save a post-pairing checkpoint, publish, and confirm the live route
- [x] Add a Mortgage Pairings UI-contract test covering empty state, sourced evidence rendering, and approve/dismiss actions (107 tests passing)
- [x] Save and publish a post-pairing checkpoint, then verify the live /pairings route (checkpoint e24fb1c5; live /pairings returned HTTP 200)
