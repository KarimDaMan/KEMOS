# KEM Debian GNOME WebVM

Experimental Debian Bookworm + GNOME Flashback desktop running client-side in Chrome with CheerpX.

Open the deployed page at `/debian-gnome/`. The base filesystem is built by GitHub Actions and split into WebVM-compatible GitHubDevice chunks, so GitHub Pages can stream disk blocks on demand.

The VM is isolated from ChromeOS. Its writable overlay is stored in IndexedDB in the browser profile.

Default account inside the VM:

- user: `user`
- password: `password`
- root password: `password`

The project uses GNOME Flashback/Metacity because normal GNOME Shell expects hardware-accelerated 3D rendering.
