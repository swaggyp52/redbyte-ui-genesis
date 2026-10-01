# RedByte local release candidate

Unzip the complete folder into a writable Windows x64 location. Double-click
`Start-RedByte.cmd`. It runs the included Node 20.19.0 locally, then opens
`http://127.0.0.1:5188/os/` in your default browser. It needs no global Node install,
package install, administrator privilege, cloud account or internet connection.
Keep the runtime folder beside the app. `Stop-RedByte.cmd` stops this folder's server.
The CMD entry uses bundled Node directly; it does not override PowerShell execution
policy. You can also run it from CMD with `--port 5189 --no-browser`. Use the same
`--port` for Stop. Repeated Start reopens this folder's running instance. If another
service or extracted folder owns the port, Start explains the conflict and leaves it
running. Stop requires this folder's matching private ownership receipt; it does not
kill an arbitrary PID. Startup errors stay visible and logs live in `.logs`.
If Windows reports an untrusted download, inspect the package origin/checksum;
this candidate is unsigned. Do not bypass a browser certificate warning.

Use the same browser and address to resume your work. Saved projects belong to
that browser origin, including its port. File → Export Project Backup downloads
a complete session backup; keep a copy outside the browser before moving devices,
changing ports or clearing browser data. Open Existing Project → Open .rbproj File
also accepts `.rb-session.json` backups. A plain `.rbproj` carries design/source/
mapping content; a complete session backup carries scenarios and retained recordings.
Format 1 remains compatible: absent source models derive from legacy HDL, while an
explicit empty source model stays empty. Existing raw named XDC sets remain references;
they cannot activate without a structured mapping snapshot. Unknown utility source text
is preserved without execution. Unsupported newer authoring schemas refuse to open and
leave the current project intact. Recovery copies keep recordings and receipts while
rebinding recording ownership to the separately named backup project's identity.
The app requires this local server; opening `index.html` via `file://` is unsupported.
The application ZIP does not contain your browser projects. Moving the extracted
folder or replacing the candidate preserves them when you stop the old instance and
reuse the exact same address, port and browser profile. A different port, `localhost`
instead of `127.0.0.1`, another browser or cleared browser data starts a different
storage context. Import your session backup there. Side-by-side extraction is safe;
only one server can use each port. Do not copy `.logs` ownership files between folders.

To check the candidate, compare the ZIP with its adjacent `.sha256` file using
`Get-FileHash -Algorithm SHA256`. `candidate.json` identifies the Git HEAD plus the
actual source content digest; an uncommitted candidate is not identified by HEAD alone.
`SHA256SUMS.txt` records every packaged file except the checksum list itself.

For a source rebuild in the repository, use its pinned Node 20.19.0 and pnpm 10.24.0,
set `RB_CANDIDATE_VERSION=1.0.0-rc.2`, and run `corepack pnpm build:unified` followed
by `corepack pnpm release:package:local 1.0.0-rc.2`. The packager refuses a stale
source/build fingerprint or an existing version directory. It archives the same
files twice and requires equal ZIP hashes; this is reproducible packaging of a
given build, not a claim that independently timed builds have identical metadata.
For a release build on Windows, first stop repository preview servers and move
the generated `apps/playground/dist` into a new ignored `.redbyte` archive folder.
The Windows Vite configuration retains old output to tolerate file locks; starting
with an absent output directory prevents shipping old hashed assets. Preserve the
archive and all source work. The completed candidate's unpack audit compares every
app file with the fresh unified distribution.
The repository's `release:verify:local` runs the maintained browser journeys against
the unpacked candidate. Session portability also needs a second local origin; start
the same folder with `Start-RedByte.cmd --port 5189 --no-browser` and set
`RB_SECOND_ORIGIN_URL=http://127.0.0.1:5189/os/` for that test. Ordinary use stays on 5188.

For an owner walkthrough, start Blank project. Place two Input Pins, an AND Gate
and an Output Pin. Name them A, B and Y. Wire A/B to the gate's a/b ports and out
to Y. Use Test this design, generate four combinational cases, and author Y as
0,0,0,1. Run, change the final expectation to 0, rerun and inspect the failure.
Repair the expectation, rerun, Save, Close Project and resume it from Recent.
In Board map A/B/Y to SW0/SW1/LD0. Capture a named constraint set, change a live
pin, then activate the captured set. In Package inspect top.xdc and download the
ZIP. The expected PACKAGE_PIN values are V17, V16 and U16. The ZIP receipt hashes
the requested bytes; your browser controls their final disk destination.

For a substantial assignment, open `samples/enabled-modulo-8-counter.rb-session.json`
through the same file chooser. `samples/counter-lab.md` gives a ten-minute review of
hierarchy, three sequential scenarios, separate wiring/expectation/stimulus repairs,
historical recordings, saved recovery and the actual Basys3 package. The supplied
sample is useful starting work; the acceptance case separately authors it from blank.

The supplied original-authoring sample demonstrates preserved source files and
constraint references. Its source views are read-only. General behavioral HDL is
not compiled by the browser. Native/nested modules, vector ports, authored scenarios,
recordings, replay and VCD inspection remain supported within their documented subsets.
Register1 supports one rising-edge clock and active-high reset/enable. RegisterBus,
StateBank, multiple clocks and falling-edge registers are outside the current execution
and export boundary. Raw imported XDC stays a preserved reference; capture structured
pin assignments to make an activatable constraint set.

Generated Basys3 artifacts target xc7a35tcpg236-1 and Vivado 2024.2. Browser tests
establish E0 behavior and generated bytes. Vivado synthesis/implementation/bitstream,
board programming and physical observation remain external and unverified by this
candidate. Built-in lab profiles do not establish an instructor/LMS platform.
