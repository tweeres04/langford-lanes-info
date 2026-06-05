# Langford Lanes availability

A minimal web page that shows today's open bowling start times at Langford Lanes, so you don't have to click through Meriq's reservation flow to check.

It fetches the alley's "current status" page server-side and lists each available start time with its standard/VIP lane counts.

## How the date works

Meriq encodes the booking date as `usedate` = the number of days since **2007-01-01** (day 0). Start times in the dropdown are minutes from midnight (e.g. `645` = 10:45am). The encoding/parsing lives in `app/lanes.ts`.

## Develop

```sh
npm run dev
```

Then open http://localhost:5173.

Built with [React Router](https://reactrouter.com) (framework mode).
