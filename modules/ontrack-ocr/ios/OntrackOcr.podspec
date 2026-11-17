Pod::Spec.new do |s|
  s.name           = 'OntrackOcr'
  s.version        = '0.1.0'
  s.summary        = 'Reads text in pictures with Apple Vision, with each line’s position'
  s.author         = 'OnTrack'
  s.homepage       = 'https://github.com/Deli5150/ontrack'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
