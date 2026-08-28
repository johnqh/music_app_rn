/**
 * Declares this package as a native dependency to autolink.
 *
 * Without it the CLI treats a package with a podspec as a plain JS dependency:
 * it looks for this file to learn that there is anything native to link at all.
 */
module.exports = {
  dependency: {
    platforms: {
      macos: { podspecPath: __dirname + '/MoosiacFilePicker.podspec' },
    },
  },
};
