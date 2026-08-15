# iOS support gate

NyumbaPap must not be advertised as iOS-supported until every item below is completed on a signed EAS build and a physical iPhone (plus simulator where useful).

- [x] Expo iOS JavaScript/native-module bundle exports successfully.
- [ ] Signed EAS iOS build completes.
- [ ] App launches on simulator and physical device.
- [ ] SecureStore persists and clears the bearer session across restarts.
- [ ] Listing and exact-location maps render; pin tap/drag works.
- [ ] Photo-library and document-picker permission prompts work, including denial/retry.
- [ ] Listing images and identity documents upload as multipart form data.
- [ ] Email OTP registration/login and `nyumbapap://` deep links work.
- [ ] M-Pesa polling recovers correctly after backgrounding and resuming the app.

Last bundle-only check: 2026-08-15. Device support remains **unverified**.
