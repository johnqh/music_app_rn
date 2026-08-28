require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'MoosiacPrint'
  s.version      = package['version']
  s.summary      = package['description']
  s.license      = 'MIT'
  s.authors      = 'Moosiac'
  s.homepage     = 'https://moosiac.app'
  # Both Apple platforms, with a source file each: iOS raises a
  # `UIPrintInteractionController` and macOS runs an `NSPrintOperation`, and
  # neither class exists on the other.
  s.platforms    = { :ios => '15.1', :osx => '14.0' }
  s.source       = { :path => '.' }
  s.ios.source_files  = 'ios/**/*.{h,m,mm}', 'shared/**/*.{h,m,mm}'
  s.osx.source_files  = 'macos/**/*.{h,m,mm}', 'shared/**/*.{h,m,mm}'

  s.dependency 'React-Core'
end
