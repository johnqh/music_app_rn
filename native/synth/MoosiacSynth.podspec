require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'MoosiacSynth'
  s.version      = package['version']
  s.summary      = package['description']
  s.license      = 'MIT'
  s.authors      = 'Moosiac'
  s.homepage     = 'https://moosiac.app'
  s.platforms    = { :osx => '14.0' }
  s.source       = { :path => '.' }
  s.source_files = 'macos/**/*.{h,m,mm}'
  # The font the web plays, bundled: pressing Play needs no network.
  s.resources    = ['resources/FluidR3Mono_GM.sf3', 'resources/FluidR3Mono_License.md']

  # libfluidsynth from Homebrew (`brew install fluid-synth`). A development
  # link: a distributable build has to bundle the dylib and its dependencies
  # (glib, libsndfile) into the app instead.
  fluidsynth_prefix = ENV['FLUIDSYNTH_PREFIX'] || '/opt/homebrew'
  s.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => "\"#{fluidsynth_prefix}/include\"",
  }
  s.user_target_xcconfig = {
    'OTHER_LDFLAGS' => "-L\"#{fluidsynth_prefix}/lib\" -lfluidsynth",
  }

  s.dependency 'React-Core'
end
