# Quickstart: Profile Page Feature

**Branch**: `007-profile-page`

## Prerequisites

- Node.js 20.x
- Repo cloned and on branch `007-profile-page`

## Setup

```bash
npm install
npm run db:init     # initialise SQLite schema (skip if already initialised)
npm run db:seed     # optional — populate demo application data
```

## Development

Run the backend API and frontend dev server together:

```bash
# Terminal 1
npm run server:dev

# Terminal 2
npm run dev
```

Frontend: `http://localhost:5173`  
API: `http://localhost:3001` (proxied at `/api` by Vite)

## New Files in This Feature

| File | Purpose |
|------|---------|
| `src/pages/Profile.js` | Full rewrite — new Profile page |
| `src/pages/ProfileEdit.js` | New Edit / Setup Profile page |
| `src/components/DonutChart.js` | SVG donut chart component |
| `src/components/StackedBar.js` | Horizontal stacked bar component |
| `src/data/profileStore.js` | Profile localStorage read/write |
| `src/models/profile.js` | Validation, normalisation, AppCounts helpers |

## Verify the Feature

1. Open the app and click **Profile** in the nav — should show the no-profile empty state.
2. Click **Set Up Profile** — should open the Edit Profile page with a back button and stacked cards.
3. Fill in First Name + Last Name in Basic Info, click **Save**.
4. Click **← Back to Profile** — welcome heading should now show "Welcome back, {firstName}."
5. On desktop: hover a donut chart segment — tooltip should appear.
6. On mobile (or narrow viewport): the donut chart should be replaced by a stacked bar. Tap a segment to see the inline label.
7. Click **Go to Tracker** — should navigate to the Tracker page.
8. Click **Edit Profile** in the profile section header — should navigate to the Edit Profile page.

## Testing

```bash
npm run test:run
```

New test files:
- `tests/models/profile.test.js` — validation and AppCounts helpers
- `tests/pages/Profile.test.js` — page-level tests

## Linting

```bash
npm run lint
```

## localStorage Key

Profile data is stored under `apptracker_profile`. To reset the profile during testing, run in browser DevTools:

```js
localStorage.removeItem('apptracker_profile');
```
