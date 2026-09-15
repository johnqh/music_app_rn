require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'MoosiacPlayhead'
  s.version      = package['version']
  s.summary      = package['description']
  s.license      = 'MIT'
  s.authors      = 'Moosiac'
  s.homepage     = 'https://moosiac.app'
  s.platforms    = { :osx => '14.0' }
  s.source       = { :path => '.' }
  s.source_files = 'macos/**/*.{h,m,mm}'

  s.dependency 'React-Core'
end
