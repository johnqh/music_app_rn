/**
 * Gives every file a patch in patches/ is about to change a copy of its own,
 * before patch-package edits it.
 *
 * bun installs by hard-linking node_modules to its global package cache, and
 * it does not honour `backend` from bunfig.toml (only `--backend=copyfile`
 * on the command line). patch-package edits files in place, so the edit went
 * through the link into the cache's "pristine" copy. Another app on the same
 * machine that patches the same package version with bun's own
 * `patchedDependencies` (sudojo_app_rn, react-native-svg 15.12.1) then got the
 * patch applied twice — duplicate declarations, and a bundle that would not
 * load. Breaking the link first leaves the cache untouched: the file is read,
 * unlinked and written back, so node_modules holds a private copy.
 *
 * Run before patch-package, from postinstall.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const patchesDir = path.join(root, 'patches');

let unshared = 0;
for (const name of fs.existsSync(patchesDir)
  ? fs.readdirSync(patchesDir)
  : []) {
  if (!name.endsWith('.patch')) continue;
  const patch = fs.readFileSync(path.join(patchesDir, name), 'utf8');
  for (const match of patch.matchAll(/^diff --git a\/(\S+) b\//gm)) {
    const file = path.join(root, match[1]);
    if (!fs.existsSync(file)) continue;
    if (fs.statSync(file).nlink < 2) continue; // already a private copy
    const contents = fs.readFileSync(file);
    fs.unlinkSync(file);
    fs.writeFileSync(file, contents);
    unshared += 1;
  }
}
if (unshared > 0) {
  console.log(
    `unshare-patched-files: ${unshared} file(s) copied out of the package cache`,
  );
}
