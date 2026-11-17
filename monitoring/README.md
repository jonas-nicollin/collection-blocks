# Public site monitor

The scheduled workflow checks public pages in fresh Chromium contexts at 08:17
Europe/Zurich each day. It also supports manual runs in GitHub Actions.
Desktop and touch-mobile projects share the same four functional checks.
An initial failure is retried once in a fresh test context before the job fails.
Reports, failure screenshots and traces are retained as an Actions artifact for
14 days. No script is installed on the monitored site and no editor session,
Google credentials, or visitor data is used.

Configure the repository variable `CB_MONITOR_TARGETS` as a JSON array. Supported
objects use `name`, `url`, and `kind`: `query` (plus `filter`, `filterParam`),
`locator` (plus `filter`, `filterParam`, URL containing four route stops),
`member` (plus `title`, `backPath`), or `gallery` (plus `backPath`, a compact
single-image gallery). URLs and editorial labels remain site-owned configuration.

The monitor checks rendered results and actions, not snapshots of internal
Squarespace classes. Shared public component selectors remain its contract.
Changing representative editorial content may require updating the targets.
Review the report after a shared runtime or site configuration publication.

GitHub failure notifications follow the account's Actions notification settings.
No additional email, messaging channel or issue creation is configured.
GitHub may delay scheduled runs and disables schedules in public repositories
after 60 days without repository activity. Re-enable in Actions if that occurs;
this monitor does not generate artificial commits to keep itself alive.
