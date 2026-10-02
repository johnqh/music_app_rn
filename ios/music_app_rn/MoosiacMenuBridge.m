#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

/**
 * The JS half of the iPad menu bar — the counterpart of macOS's
 * `MoosiacMenuBridge` (`macos/music_app_rn-macOS/AppDelegate.mm`), under the
 * same module name so `src/app/menu-commands.ts` serves every platform with
 * a menu bar without knowing which one it is on.
 *
 * The menu itself is `AppDelegate.swift`'s (`buildMenu(with:)`). It posts each
 * command as a notification and this module turns it into the `menuCommand`
 * event; going the other way, `setEnabledCommands` is posted back for
 * `AppDelegate`'s `canPerformAction(_:withSender:)`. Notifications rather
 * than a direct call because the two sides are different languages and
 * neither needs the other's header — no bridging header for one set.
 *
 * Written in Objective-C because `RCT_EXPORT_MODULE` and `RCT_EXPORT_METHOD`
 * are macros, which Swift cannot use.
 */
static NSString *const kMoosiacMenuCommand = @"MoosiacMenuCommand";
static NSString *const kMoosiacMenuAvailability = @"MoosiacMenuAvailability";

@interface MoosiacMenuBridge : RCTEventEmitter <RCTBridgeModule>
@end

@implementation MoosiacMenuBridge

RCT_EXPORT_MODULE(MoosiacMenuBridge);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

/*
  The one difference from the Mac's bridge. On macOS the menu bar replaces the
  editor's title bar (`hasMenuBar()`); an iPad is used by touch as often as
  from a keyboard, so the title bar stays and the menu is a second way in.
*/
- (NSDictionary *)constantsToExport
{
  return @{@"replacesTitleBar" : @NO};
}

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
  [[NSNotificationCenter defaultCenter] removeObserver:self name:kMoosiacMenuCommand object:nil];
}

- (void)handleMenuCommand:(NSNotification *)note
{
  [self sendEventWithName:@"menuCommand" body:note.userInfo];
}

RCT_EXPORT_METHOD(setEnabledCommands:(NSArray<NSString *> *)commands)
{
  NSArray<NSString *> *copy = [commands copy];
  dispatch_async(dispatch_get_main_queue(), ^{
    [[NSNotificationCenter defaultCenter] postNotificationName:kMoosiacMenuAvailability
                                                        object:nil
                                                      userInfo:@{@"commands" : copy}];
  });
}

@end
