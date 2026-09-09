# Adds a test-only target to an ephemeral Expo prebuild; never changes app signing.
require 'xcodeproj'
project = Xcodeproj::Project.open(ARGV.fetch(0))
app = project.targets.find { |target| target.product_type == 'com.apple.product-type.application' }
raise 'Missing app target' unless app
target = project.new_target(:ui_test_bundle, 'MoodTrackerUITests', :ios, '18.0')
target.add_dependency(app)
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!({
    'SWIFT_VERSION' => '5.0',
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.zhenyu.moodjournal.app.UITests',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'TEST_TARGET_NAME' => app.name,
    'TARGETED_DEVICE_FAMILY' => '1',
    'CODE_SIGNING_ALLOWED' => 'NO',
    'CLANG_ENABLE_MODULES' => 'YES',
  })
end
project.root_object.attributes['TargetAttributes'] ||= {}
project.root_object.attributes['TargetAttributes'][target.uuid] = { 'TestTargetID' => app.uuid }
file = project.main_group.new_file(File.expand_path('../tests/ios/ComposerUITests.swift', __dir__))
target.source_build_phase.add_file_reference(file)
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(target)
scheme.set_launch_target(app)
scheme.test_action.build_configuration = 'Release'
scheme.save_as(ARGV.fetch(0), 'MoodTrackerUI', true)
