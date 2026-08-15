# NyumbaPap Mobile

Expo/React Native client for the existing NyumbaPap backend. All business data, authentication, image processing, moderation, location privacy, and M-Pesa decisions stay server-side.

## Run

Copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL`, then run from the repository root:

```sh
npm install
npm run dev:mobile
```

The default API URL is the deployed NyumbaPap backend. Native requests identify the Expo client, fetch a signed CSRF token, keep the session token in `expo-secure-store`, and send it as a mobile-only bearer token. Browser cookie authentication remains unchanged.

## Design source

`theme.ts` is transcribed from `frontend/src/app/globals.css`, `frontend/styles.css`, `frontend/src/app/marketplace.module.css`, and `frontend/src/app/portal.module.css`; comments beside each token identify its source declaration. The app uses StyleSheet because the web project uses CSS Modules rather than Tailwind or CSS-in-JS.

Native text rendering, system pickers, and `react-native-maps` cannot be byte-identical to DOM controls or Leaflet tiles. Their colors, spacing, radii, hierarchy, labels, and interaction states mirror the mobile web layout; native platform behavior is retained where it improves accessibility.

## Interior images

Landlords can select and upload interior photos from the dashboard. Uploads use the existing multipart listing-image API, where the backend strips metadata, creates responsive variants, moderates the media, and stores the processed files in Nisoko Object Storage. The storage credential is never bundled into this app.
