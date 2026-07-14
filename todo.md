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
- [ ] Checkpoint + deploy to public URL
