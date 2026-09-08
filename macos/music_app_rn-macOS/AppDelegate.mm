#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

/**
 * The File menu's Import/Export items, forwarded to JavaScript.
 *
 * The menu is AppKit's and the importers are JavaScript's, so something has to
 * cross. The storyboard items target First Responder; the app delegate is in
 * that chain, so it answers them and posts a notification, and the module
 * below turns that into a JS event. Two hops rather than one because a menu
 * action cannot reach a React module directly, and because the delegate must
 * answer the selector for AppKit to enable the item at all — an item whose
 * selector nobody implements is greyed out with no explanation.
 */
static NSString *const kMoosiacMenuCommand = @"MoosiacMenuCommand";

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification
{
  self.moduleName = @"MoosiacRN"; // matches app.json and index.js; the macOS project was generated under the repo name
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};
  self.dependencyProvider = [RCTAppDependencyProvider new];
  
  return [super applicationDidFinishLaunching:notification];
}

#pragma mark - File menu

/*
  One method per item rather than a single action with a tag: the selector name
  *is* the wiring in a storyboard, and a tag is a number in a XIB that means
  nothing when read back.
*/
- (void)postMenuCommand:(NSString *)command
{
  [[NSNotificationCenter defaultCenter] postNotificationName:kMoosiacMenuCommand
                                                      object:nil
                                                    userInfo:@{@"command" : command}];
}

/*
  New, Open, Save and Save As were greyed out from the day the project was
  generated: this is not an `NSDocument` app, so nothing in the responder chain
  implemented `newDocument:`, `openDocument:`, `saveDocument:` or
  `saveDocumentAs:`, and AppKit disables an item whose selector nobody answers.
  They have selectors of their own now, and JavaScript owns what they mean.
*/
- (void)moosiacFileNew:(id)sender { [self postMenuCommand:@"file.new"]; }
- (void)moosiacFileOpen:(id)sender { [self postMenuCommand:@"file.open"]; }
- (void)moosiacFileSave:(id)sender { [self postMenuCommand:@"file.save"]; }
- (void)moosiacFileSaveAs:(id)sender { [self postMenuCommand:@"file.saveAs"]; }

- (void)moosiacImportMidi:(id)sender { [self postMenuCommand:@"import.midi"]; }
- (void)moosiacImportMusicXml:(id)sender { [self postMenuCommand:@"import.musicxml"]; }
- (void)moosiacImportTracker:(id)sender { [self postMenuCommand:@"import.tracker"]; }
- (void)moosiacImportAudio:(id)sender { [self postMenuCommand:@"import.audio"]; }
- (void)moosiacExportMidi:(id)sender { [self postMenuCommand:@"export.midi"]; }
- (void)moosiacExportMusicXml:(id)sender { [self postMenuCommand:@"export.musicxml"]; }
- (void)moosiacExportXm:(id)sender { [self postMenuCommand:@"export.xm"]; }
- (void)moosiacExportWav:(id)sender { [self postMenuCommand:@"export.wav"]; }
- (void)moosiacExportMp3:(id)sender { [self postMenuCommand:@"export.mp3"]; }

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

/// This method controls whether the `concurrentRoot`feature of React18 is turned on or off.
///
/// @see: https://reactjs.org/blog/2022/03/29/react-v18.html
/// @note: This requires to be rendering on Fabric (i.e. on the New Architecture).
/// @return: `true` if the `concurrentRoot` feature is enabled. Otherwise, it returns `false`.
- (BOOL)concurrentRootEnabled
{
#ifdef RN_FABRIC_ENABLED
  return true;
#else
  return false;
#endif
}

@end

/**
 * The JS half of the menu bridge.
 *
 * Declared here rather than in its own file so the Xcode project needs no new
 * build-file entry — `RCT_EXPORT_MODULE` registers it through the Objective-C
 * runtime, and a second class in one .mm is ordinary Objective-C.
 *
 * `startObserving`/`stopObserving` rather than an unconditional observer:
 * `RCTEventEmitter` only calls them while JavaScript actually has a listener,
 * so a menu command fired before the app has mounted is dropped instead of
 * queued against a bridge that cannot deliver it.
 */
@interface MoosiacMenuBridge : RCTEventEmitter <RCTBridgeModule>
@end

@implementation MoosiacMenuBridge

RCT_EXPORT_MODULE(MoosiacMenuBridge);

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"menuCommand" ];
}

- (void)startObserving
{
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handleMenuCommand:)
                                               name:kMoosiacMenuCommand
                                             object:nil];
}

- (void)stopObserving
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)handleMenuCommand:(NSNotification *)note
{
  [self sendEventWithName:@"menuCommand" body:note.userInfo];
}

@end
