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
