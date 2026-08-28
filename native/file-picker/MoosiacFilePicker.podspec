require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'MoosiacFilePicker'
  s.version      = package['version']
  s.summary      = package['description']
  s.license      = 'MIT'
  s.authors      = 'Moosiac'
  s.homepage     = 'https://moosiac.app'
  # macOS only, deliberately: iOS and Android use
  # `@react-native-documents/picker`, which is the right control on each of
  # them. This exists because that package is `:ios` and the Mac is not iOS.
  s.platforms    = { :osx => '14.0' }
  s.source       = { :path => '.' }
  s.source_files = 'macos/**/*.{h,m,mm}'

  s.dependency 'React-Core'
end
