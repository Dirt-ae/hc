# HC

Hour Challenge prototype with a public submission page, a hidden admin page, Netlify Functions, Supabase storage for contest data, and video uploads through server-side signed upload creation.

## Netlify

Connect this repository to Netlify and use:

- Build command: leave blank
- Publish directory: `.`
- Functions directory: `netlify/functions`

Set these environment variables in Netlify:

- `ADMIN`
- `BUNNY_API_KEY`
- `BUNNY_LIBRARY_ID`
- `BUNNY_CDN_HOSTNAME`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Supabase

Run `supabase.sql` in the Supabase SQL editor before using the site.

## Pages

- Public page: `/`
- Admin page: `/dirtonly` or `/admin.html`
