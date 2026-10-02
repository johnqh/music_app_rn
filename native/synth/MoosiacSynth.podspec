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
  # two, so the same source compiles unchanged for both, against the same
  # vendored framework.
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

  # FluidSynth on both platforms: apple/Frameworks/FluidSynth.xcframework,
  # built from source with SF3 (Ogg Vorbis) support by
  # scripts/build-fluidsynth-apple.sh — an iPhone/iPad slice, a simulator
  # slice and a universal macOS slice. The official prebuilt framework is
  # built without libsndfile and cannot read the bundled .sf3.
  #
  # macOS used to link Homebrew's libfluidsynth. That built only on a Mac with
  # it installed: Xcode Cloud failed with "'fluidsynth.h' file not found",
  # Homebrew's arm64-only copy left a universal archive with no Intel slice,
  # and the shipped app would have looked for it under /opt/homebrew on the
  # user's Mac. Vendored, the framework is embedded in the app like any other.
  #
  # `fluid_coreaudio.c`'s non-HAL path calls `setupAVAudioSession` itself on
  # iOS, so nothing here configures a session by hand — `AVFoundation` is
  # linked because that call lives there, `AudioToolbox` because the driver is
  # an `AudioUnit`. The macOS slice links CoreAudio, AudioUnit and CoreMIDI
  # itself.
  s.vendored_frameworks = 'apple/Frameworks/FluidSynth.xcframework'
  s.ios.frameworks = ['AudioToolbox', 'AVFoundation', 'CoreAudio']

  s.dependency 'React-Core'
end
