# Production readiness runbook

## PWA and accessibility

- Test installability and the offline fallback in production mode over HTTPS. Service workers are deliberately disabled in development.
- Run keyboard-only checks for navigation, marketplace filters/cards, dialogs, authentication, dashboards, and moderation.
- Run screen-reader checks with NVDA/Firefox or VoiceOver/Safari, at 200% zoom, and with reduced motion enabled.
- Run automated WCAG checks in CI and manually verify contrast, error announcements, focus order, form labels, image alternatives, and touch target size.
- Offline mode is read-only. Authentication, payments, enquiries, reports, and writes must show network failure rather than queueing sensitive requests.

## Consent and legal review

- Optional analytics must subscribe to `nyumbapap:analytics-consent` and initialise only when `event.detail.analytics === "granted"`.
- Never place exact locations, protected contacts, identity data, payment receipts, free-text enquiries, or stable user identifiers in analytics.
- Obtain Kenyan privacy, consumer, payments, tax, retention, and terms review. Replace the launch-draft notices with the approved legal entity, contacts, retention schedule, subprocessors, refund terms, and complaint channels.

## Backups

Run encrypted backups from a restricted host and copy them to versioned, access-logged storage in a separate failure domain:

```sh
DATABASE_URL='...' BACKUP_DIR=/secure/backups ./ops/backup-postgres.sh
./ops/verify-backup.sh /secure/backups/nyumbapap-YYYYMMDDTHHMMSSZ.dump
```

The checksum and `pg_restore --list` check detect corruption but do not prove recoverability. Restore drills do.

## Disaster-recovery drill

Provision a disposable database whose name contains `_dr_`, apply the same PostgreSQL/PostGIS major versions as production, and run:

```sh
DR_RESTORE_DATABASE_URL='postgresql://.../nyumbapap_dr_20260812' \
DR_CONFIRM=RESTORE_DISPOSABLE_DATABASE \
./ops/dr-drill.sh /secure/backups/nyumbapap-YYYYMMDDTHHMMSSZ.dump
```

Record backup age, restore duration, row counts for critical tables, application health-check results, owner, date, incidents, and follow-up actions. Quarterly drills should test loss of the primary region and credentials, not only database restoration. Do not delete the drill database until evidence has been reviewed, then dispose of it according to the approved process.

## Launch gates

- Public HTTPS origins, stable Daraja callback, CSP, monitoring alerts, and secrets are configured.
- Backup jobs have alerted successfully and at least one independent restore drill meets the agreed RPO/RTO.
- Notification outbox consumers, reconciliation, malware scanning, retention jobs, incident response, and customer-support escalation are operational.
- Legal notices and contact details are approved; accessibility findings have owners and no launch-blocking issues remain.
