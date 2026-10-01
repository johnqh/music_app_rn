require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'MoosiacSynth'
  s.version      = package['version']
  s.summary      = package['description']
  s.license      = 'MIT'
  s.authors      = 'Moosiac'
  s.homepage     = 'https://moosiac.app'
  # `apple/` is shared by both: the Objective-C++ wrapper calls nothing but
  # the FluidSynth C API and Foundation, neither of which differs between the
  # two, so the same source compiles unchanged for both — only how libfluidsynth
  # itself is linked differs below.
  s.platforms    = { :osx => '14.0', :ios => '15.0' }
  s.source       = { :path => '.' }
  # `apple/` and nothing below it: `apple/**` would also match the 36 headers
  # inside the vendored FluidSynth.xcframework, which as a static library is
  # harmless and as a framework is fatal — CocoaPods copies every matched
  # header as a public header of MoosiacSynth.framework, and the device and
  # simulator slices carry the same names, so Xcode stops with "Multiple
  # commands produce .../Headers/fluidsynth.h". The wrapper is the two files
  # in `apple/` itself; the xcframework is vendored below, headers included.
  s.source_files = 'apple/*.{h,m,mm}'
  # The font the web plays, bundled: pressing Play needs no network.
  s.resources    = ['resources/FluidR3Mono_GM.sf3', 'resources/FluidR3Mono_License.md']

  # macOS: libfluidsynth from Homebrew (`brew install fluid-synth`). A
  # development link: a distributable build has to bundle the dylib and its
  # dependencies (glib, libsndfile) into the app instead.
  fluidsynth_prefix = ENV['FLUIDSYNTH_PREFIX'] || '/opt/homebrew'
  s.osx.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => "\"#{fluidsynth_prefix}/include\"",
  }
  s.osx.user_target_xcconfig = {
    'OTHER_LDFLAGS' => "-L\"#{fluidsynth_prefix}/lib\" -lfluidsynth",
  }

  # iOS: the official prebuilt XCFramework FluidSynth publishes with every
  # release (github.com/FluidSynth/fluidsynth/releases,
  # fluidsynth-v2.6.1-iOS.zip) — device + simulator slices, vendored rather
  # than built from source, the same way a distributable macOS build would
  # have to. `fluid_coreaudio.c`'s non-HAL path (compiled into this binary)
  # calls `setupAVAudioSession` itself on iOS, so nothing here configures a
  # session by hand — `AVFoundation` is linked because that call lives there,
  # `AudioToolbox` because the driver is an `AudioUnit`.
  s.ios.vendored_frameworks = 'apple/Frameworks/FluidSynth.xcframework'
  s.ios.frameworks = ['AudioToolbox', 'AVFoundation', 'CoreAudio']

  s.dependency 'React-Core'
end
