/**
 * Declares this package as a native dependency to autolink, macOS only.
 */
module.exports = {
  dependency: {
    platforms: {
      macos: { podspecPath: __dirname + '/MoosiacPlayhead.podspec' },
    },
  },
};
