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
 * A cached copy can also be only partly patched, so restore any already
 * applied file hunks after copying. patch-package then sees one pristine
 * package and applies the complete patch. Run before it, from postinstall.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const patchesDir = path.join(root, 'patches');

let unshared = 0;
let restored = 0;
for (const name of fs.existsSync(patchesDir)
  ? fs.readdirSync(patchesDir)
  : []) {
  if (!name.endsWith('.patch')) continue;
  const patchFile = path.join(patchesDir, name);
  const patch = fs.readFileSync(patchFile, 'utf8');
  for (const match of patch.matchAll(/^diff --git a\/(\S+) b\//gm)) {
    const file = path.join(root, match[1]);
    if (!fs.existsSync(file)) continue;
    if (fs.statSync(file).nlink >= 2) {
      const contents = fs.readFileSync(file);
      fs.unlinkSync(file);
      fs.writeFileSync(file, contents);
      unshared += 1;
    }

    // Bun's cache can itself contain an earlier patch. A package with only
    // some files patched makes patch-package fail even though its version is
    // correct. Restore each already-patched file after unsharing it, then let
    // patch-package apply the complete patch in its usual postinstall step.
    const args = ['apply', '-R', `--include=${match[1]}`, patchFile];
    const check = spawnSync('git', [...args.slice(0, 2), '--check', ...args.slice(2)], {
      cwd: root,
      stdio: 'ignore',
    });
    if (check.error) throw check.error;
    if (check.status !== 0) continue;
    const reverse = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (reverse.error) throw reverse.error;
    if (reverse.status !== 0) {
      throw new Error(`Could not restore ${match[1]}: ${reverse.stderr}`);
    }
    restored += 1;
  }
}
if (unshared > 0) {
  console.log(
    `unshare-patched-files: ${unshared} file(s) copied out of the package cache`,
  );
}
if (restored > 0) {
  console.log(`unshare-patched-files: ${restored} patched file(s) restored`);
}
