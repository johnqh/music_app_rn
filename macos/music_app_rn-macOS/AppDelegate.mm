#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
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

/*
  The commands JavaScript can answer right now, published by
  `useMenuAvailability` (`src/app/menu-commands.ts`). AppKit enables an item
  whenever somebody implements its selector, and the app delegate implements
  all of them all the time — so without this, Export, Print, Undo and the rest
  stayed enabled on the Projects and Settings tabs, where the editor that
  answers them is not mounted, and a click did nothing. `nil` until JavaScript
  first reports, which leaves every item enabled as it was before.
*/
static NSSet<NSString *> *gEnabledCommands = nil;

/*
  Which command each of the delegate's selectors posts, so `validateMenuItem:`
  can ask about a selector without a second list of item ids to keep in step
  with the storyboard. `nav.projects` is not here on purpose: it is answered
  natively as well (it brings the window back), so it is never greyed out.
*/
static NSDictionary<NSString *, NSString *> *MoosiacCommandsBySelector(void)
{
  static NSDictionary<NSString *, NSString *> *commands;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    commands = @{
      @"moosiacFileNew:" : @"file.new",
      @"moosiacFileOpen:" : @"file.open",
      @"moosiacFileSave:" : @"file.save",
      @"moosiacFileSaveAs:" : @"file.saveAs",
      @"moosiacFileSnapshots:" : @"file.snapshots",
      @"moosiacFilePrint:" : @"file.print",
      @"moosiacImportMidi:" : @"import.midi",
      @"moosiacImportMusicXml:" : @"import.musicxml",
      @"moosiacImportTracker:" : @"import.tracker",
      @"moosiacImportAudio:" : @"import.audio",
      @"moosiacExportMidi:" : @"export.midi",
      @"moosiacExportMusicXml:" : @"export.musicxml",
      @"moosiacExportXm:" : @"export.xm",
      @"moosiacExportWav:" : @"export.wav",
      @"moosiacExportMp3:" : @"export.mp3",
      @"moosiacEditUndo:" : @"edit.undo",
      @"moosiacEditRedo:" : @"edit.redo",
      @"cut:" : @"edit.cut",
      @"copy:" : @"edit.copy",
      @"paste:" : @"edit.paste",
      @"delete:" : @"edit.delete",
      @"selectAll:" : @"edit.selectAll",
      @"moosiacNavSettings:" : @"nav.settings",
      @"moosiacNavDocs:" : @"nav.docs",
    };
  });
  return commands;
}

/**
 * Open Recent, for an app with no `NSDocument`s.
 *
 * AppKit fills the storyboard's Open Recent menu from the shared
 * `NSDocumentController` — JavaScript reports each file it opens or saves
 * (`noteRecentDocument`, below) — and in a sandboxed app it keeps a
 * security-scoped bookmark with each entry, which is what lets the app reopen
 * a file the user is no longer choosing in a panel. Choosing an entry asks
 * the controller to open it as a document, which this app has no class for,
 * so the request is handed to `application:openURLs:` — the same way in as a
 * file double-clicked in Finder.
 *
 * Must be the first `NSDocumentController` created to become the shared one,
 * which is why `applicationWillFinishLaunching` makes it.
 */
@interface MoosiacDocumentController : NSDocumentController
@end

/*
  Forward-declared so `applicationDidFinishLaunching` can call it directly —
  the full class (`MoosiacProjectsWindow`, below `AppDelegate`'s own
  `@implementation`) needs `AppDelegate`'s `window`/`rootViewFactory`
  properties (inherited from `RCTAppDelegate`), which is the reverse
  dependency of the menu bridge and window-title classes below, which
  `AppDelegate` never calls into directly.
*/
@interface MoosiacProjectsWindow : NSObject <RCTBridgeModule>
+ (void)showProjectsWindow;
@end

@implementation AppDelegate

/*
  `moosiac://` links arrive as a GetURL Apple Event, which React Native's
  `RCTLinkingManager` turns into `Linking` events — but only once something
  registers it as the handler. Registered here, before launch finishes, because
  a link that *launched* the app is delivered before `didFinishLaunching`, and
  `RCTLinkingManager` keeps that one as the initial URL.
*/
- (void)applicationWillFinishLaunching:(NSNotification *)notification
{
  (void)[MoosiacDocumentController new];
  /*
    One window, so no window tabs: left on, AppKit adds Show Tab Bar and Show
    All Tabs to the View menu, which in this app could only ever show one tab.
  */
  NSWindow.allowsAutomaticWindowTabbing = NO;
  [[NSAppleEventManager sharedAppleEventManager]
      setEventHandler:[RCTLinkingManager class]
          andSelector:@selector(getUrlEventHandler:withReplyEvent:)
        forEventClass:kInternetEventClass
           andEventID:kAEGetURL];
}

/*
  A `.moo` opened from Finder — double-clicked, dragged onto the Dock icon, or
  chosen with Open With. Each file is forwarded as the link `open-links.ts`
  reads, through the same handler, so JavaScript has one way in rather than two
  and a file that launched the app is kept as the initial URL just as a link is.
*/
- (void)application:(NSApplication *)application openURLs:(NSArray<NSURL *> *)urls
{
  NSCharacterSet *allowed = [NSCharacterSet URLQueryAllowedCharacterSet].mutableCopy;
  [(NSMutableCharacterSet *)allowed removeCharactersInString:@"&=?+#"];
  for (NSURL *url in urls) {
    NSString *link = url.isFileURL
        ? [@"moosiac://open?path="
              stringByAppendingString:[url.path stringByAddingPercentEncodingWithAllowedCharacters:allowed]]
        : url.absoluteString;
    NSAppleEventDescriptor *event =
        [NSAppleEventDescriptor appleEventWithEventClass:kInternetEventClass
                                                 eventID:kAEGetURL
                                        targetDescriptor:nil
                                                returnID:kAutoGenerateReturnID
                                           transactionID:kAnyTransactionID];
    [event setParamDescriptor:[NSAppleEventDescriptor descriptorWithString:link] forKeyword:keyDirectObject];
    [RCTLinkingManager getUrlEventHandler:event withReplyEvent:[NSAppleEventDescriptor nullDescriptor]];
  }
}

- (void)applicationDidFinishLaunching:(NSNotification *)notification
{
  self.moduleName = @"MoosiacRN"; // the JS registration name: matches app.json and index.js
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};
  self.dependencyProvider = [RCTAppDependencyProvider new];

  [self giveFileMenuItemsImages];
  [super applicationDidFinishLaunching:notification];

  /*
    One window. It opens on the Projects tab, which JavaScript chooses
    (`Navigation.tsx`), so there is nothing to arrange here: `super`'s call
    above created and showed `self.window`, and that is the window the app
    has. Projects used to be a second window shown in front of this one,
    which was hidden at launch.

    Hidden when closed, not destroyed. The window holds the React tree every
    menu command is answered by and every project opens into; released on
    close, the next project chosen had no window to appear in.
  */
  self.window.releasedWhenClosed = NO;

  /*
    The app's name, not the module's. `super` titles the window with
    `moduleName`, which is the JS registration name ("MoosiacRN") and has to
    stay that, so until a document's title arrives from `WindowTitleSync` the
    window read "MoosiacRN". `CFBundleName` is `$(PRODUCT_NAME)`, "Moosiac" —
    the name the Dock and the app menu already show.
  */
  NSString *appName = NSBundle.mainBundle.infoDictionary[@"CFBundleName"];
  if (appName.length > 0) self.window.title = appName;
}

/*
  macOS 26 draws a symbol beside every standard menu item (New, Open, Save,
  Print) and indents the titles to make room for it. Import and Export are ours,
  so AppKit has no symbol for them and their titles sat flush left, out of line
  with every other item in the menu. They get the system's own import and export
  symbols, which keeps the column aligned; on an older macOS nothing reserves
  that space and the images are simply not drawn.
*/
- (void)giveFileMenuItemsImages
{
  if (@available(macOS 11.0, *)) {
    NSMenu *file = [[NSApp mainMenu] itemWithTitle:@"File"].submenu;
    NSDictionary<NSString *, NSString *> *symbols = @{
      @"Import" : @"square.and.arrow.down",
      @"Export" : @"square.and.arrow.up",
    };
    [symbols enumerateKeysAndObjectsUsingBlock:^(NSString *title, NSString *symbol, BOOL *stop) {
      NSMenuItem *item = [file itemWithTitle:title];
      if (item.image == nil) {
        item.image = [NSImage imageWithSystemSymbolName:symbol accessibilityDescription:nil];
      }
    }];
  }
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

/*
  The title bar's own buttons, now that the title bar itself is gone on
  desktop (`AppLayout`'s `hasMenuBar()` gate — see `menu-commands.ts`). Undo
  and Redo repoint the storyboard's stock Edit-menu items, which targeted
  `undo:`/`redo:` on the first responder and did nothing here for the same
  reason New/Open/Save did nothing: nothing in the chain implements them.
  Print repoints the File menu's own stock item the same way. Projects and
  Settings are new items — the title bar's rightmost two buttons, which
  nothing else in the app reaches on macOS.
*/
- (void)moosiacEditUndo:(id)sender { [self postMenuCommand:@"edit.undo"]; }
- (void)moosiacEditRedo:(id)sender { [self postMenuCommand:@"edit.redo"]; }
- (void)moosiacFilePrint:(id)sender { [self postMenuCommand:@"file.print"]; }
- (void)moosiacFileSnapshots:(id)sender { [self postMenuCommand:@"file.snapshots"]; }
/*
  The window is brought forward here, natively, as well as the command being
  announced to JavaScript. With the window closed there is nothing on screen
  for the Projects tab to appear in, and the listener that answers
  `nav.projects` can only choose the tab — so with no window open, exactly
  when a way to open one is wanted, File ▸ Projects… would do nothing.
  Asking for a window already in front is a no-op.
*/
- (void)moosiacNavProjects:(id)sender
{
  [self.window makeKeyAndOrderFront:nil];
  [self postMenuCommand:@"nav.projects"];
}

/*
  Clicking the Dock icon with nothing open: the window, back again.
*/
- (BOOL)applicationShouldHandleReopen:(NSApplication *)sender hasVisibleWindows:(BOOL)hasVisibleWindows
{
  if (!hasVisibleWindows) [self.window makeKeyAndOrderFront:nil];
  return YES;
}
- (void)moosiacNavSettings:(id)sender { [self postMenuCommand:@"nav.settings"]; }
// Help ▸ Moosiac Help: the app's own Docs tab. There is no Help Book.
- (void)moosiacNavDocs:(id)sender
{
  [self.window makeKeyAndOrderFront:nil];
  [self postMenuCommand:@"nav.docs"];
}

#pragma mark - Edit menu

/*
  Cut, Copy, Paste, Delete and Select All keep AppKit's own selectors, so a
  focused text field still answers them first — its field editor is ahead of
  the app delegate in the responder chain. With no text field focused they
  fall through to here and act on the score's selection (`AppLayout`).
*/
- (void)cut:(id)sender { [self postMenuCommand:@"edit.cut"]; }
- (void)copy:(id)sender { [self postMenuCommand:@"edit.copy"]; }
- (void)paste:(id)sender { [self postMenuCommand:@"edit.paste"]; }
- (void)delete:(id)sender { [self postMenuCommand:@"edit.delete"]; }
- (void)selectAll:(id)sender { [self postMenuCommand:@"edit.selectAll"]; }

- (BOOL)validateMenuItem:(NSMenuItem *)item
{
  NSString *command = MoosiacCommandsBySelector()[NSStringFromSelector(item.action)];
  if (command == nil || gEnabledCommands == nil) return YES;
  return [gEnabledCommands containsObject:command];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  /*
    `RCTBundleURLProvider` has no packager to auto-detect on macOS the way it
    does on a paired iOS simulator/device, so with nothing set it resolves to
    nil rather than a guess — "No script URL provided" in the RedBox, with
    every other symptom (no network request, no logs, nothing our own code
    ever runs) following from that. Set explicitly, matching the same fix on
    the iOS side (`AppDelegate.swift`) and this project's Metro port.
  */
  RCTBundleURLProvider *provider = [RCTBundleURLProvider sharedSettings];
  provider.jsLocation = @"localhost:8092";
  return [provider jsBundleURLForBundleRoot:@"index"];
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

// Which items `validateMenuItem:` enables — see `gEnabledCommands`.
RCT_EXPORT_METHOD(setEnabledCommands:(NSArray<NSString *> *)commands)
{
  NSSet<NSString *> *enabled = [NSSet setWithArray:commands];
  dispatch_async(dispatch_get_main_queue(), ^{
    gEnabledCommands = enabled;
  });
}

// A file opened or saved, for File ▸ Open Recent. A path or a `file://` URL.
RCT_EXPORT_METHOD(noteRecentDocument:(NSString *)uri)
{
  NSURL *url = [uri hasPrefix:@"file:"] ? [NSURL URLWithString:uri] : [NSURL fileURLWithPath:uri];
  if (url == nil || !url.isFileURL) return;
  dispatch_async(dispatch_get_main_queue(), ^{
    [[NSDocumentController sharedDocumentController] noteNewRecentDocumentURL:url];
  });
}

@end

/**
 * Sets the window's title bar text from JavaScript, and the app's own name
 * everywhere AppKit's template baked in the Xcode project's name instead.
 *
 * `CFBundleName` (Info.plist's `$(PRODUCT_NAME)`) is what an unset window
 * title falls back to, and it is the Xcode target's own name, baked in at
 * build time — not `CONSTANTS.APP_NAME`, which reads `VITE_APP_NAME` from
 * `.env` at Metro-bundle time. Keeping one name in one place (the JS
 * constant, same as every other branding string) means setting it here
 * rather than duplicating the env-var read into an Xcode build setting,
 * which would be the exact "one fact restated twice" this family's other
 * packages warn about.
 *
 * `setAppName:` is the same fix applied to the menu bar. Five places in
 * `Main.storyboard` spell the Xcode project's name literally — the App
 * menu's own title, "About/Hide/Quit music_app_rn" inside it, and
 * "music_app_rn Help" — because that generated template has no way to know
 * the product's name is "Moosiac" and not its codebase's. Rather than
 * hardcoding "Moosiac" into the storyboard, a second place for the two to
 * drift, every menu item is walked recursively and `PLACEHOLDER_APP_NAME`
 * replaced wherever it appears in a title — which reaches all five without
 * this file needing to know their ids, and touches nothing else, since
 * "File", "Edit", "Undo" and the rest never contain it.
 */
@interface MoosiacWindowTitle : NSObject <RCTBridgeModule>
@end

/**
 * The literal string every renamed menu item starts with — the Xcode
 * project's own name (`music_app_rn`), not `CONSTANTS.APP_NAME`. Xcode
 * generated the project under this name before the product was ever called
 * Moosiac, and every "About X"/"Hide X"/"Quit X"/"X Help" item's title is
 * this string, verbatim, from that template.
 */
static NSString *const kPlaceholderAppName = @"music_app_rn";

@implementation MoosiacWindowTitle

RCT_EXPORT_MODULE(MoosiacWindowTitle);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_EXPORT_METHOD(setTitle:(NSString *)title)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    // Every window *except* Projects: that one names itself once, natively,
    // when `MoosiacProjectsWindow` creates it, and is never the active
    // document's title — see that class for why `identifier` is the marker.
    for (NSWindow *window in [NSApplication sharedApplication].windows) {
      if ([window.identifier isEqualToString:@"MoosiacProjectsWindow"]) continue;
      window.title = title;
    }
  });
}

- (void)renameMenu:(NSMenu *)menu from:(NSString *)placeholder to:(NSString *)name
{
  for (NSMenuItem *item in menu.itemArray) {
    if ([item.title rangeOfString:placeholder].location != NSNotFound) {
      item.title = [item.title stringByReplacingOccurrencesOfString:placeholder withString:name];
    }
    if (item.submenu) [self renameMenu:item.submenu from:placeholder to:name];
  }
}

RCT_EXPORT_METHOD(setAppName:(NSString *)name)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSMenu *mainMenu = [NSApplication sharedApplication].mainMenu;
    if (mainMenu) [self renameMenu:mainMenu from:kPlaceholderAppName to:name];
  });
}

@end

/**
 * A *separate* native window for the desktop Projects screen — not a screen
 * pushed onto the editor window's own stack, and not application-modal: the
 * editor stays interactive while this is open, ordinary-window behaviour.
 * `show`/`focusMain` are what `platform/projectsWindow.ts` calls; `File ▸
 * Projects…` (`AppDelegate`'s `moosiacNavProjects:`) reaches `show` the same
 * way every other menu command reaches JavaScript, through the notification
 * `MoosiacMenuBridge` turns into `nav.projects`, which
 * `MenuFileCommands.tsx` turns into this call — and launch reaches it
 * directly, native to native, since there is no JavaScript running yet the
 * first time it is needed.
 *
 * **One `RCTBridge`, two `RCTRootView`s.** `AppDelegate.rootViewFactory` is
 * what `RCTAppDelegate` itself uses to build the editor window's root view;
 * calling it again with a different module name (`MoosiacProjects`,
 * registered in `index.js`) returns a second root view sharing the same
 * bridge and JS runtime — which is what lets both windows read the same
 * document list (`appState.ts`'s module-level singleton) rather than each
 * holding an independent copy that could disagree about what is open.
 *
 * **Created once, then reused.** `setReleasedWhenClosed:NO` keeps the
 * `NSWindow` (and the React tree inside it — its scroll position, a
 * half-typed sign-in field) alive after the reader closes it, so a second
 * `show` brings back exactly what was there rather than a fresh mount.
 * `identifier` marks it so `MoosiacWindowTitle.setTitle:` can leave its
 * title alone — that method retitles the *document* window as the active
 * document changes, and this window is never that.
 */
@implementation MoosiacProjectsWindow

RCT_EXPORT_MODULE(MoosiacProjectsWindow);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

static NSWindow *sProjectsWindow = nil;

+ (void)showProjectsWindow
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (!sProjectsWindow) {
      RCTAppDelegate *appDelegate = (RCTAppDelegate *)[NSApplication sharedApplication].delegate;
      NSRect frame = NSMakeRect(0, 0, 900, 600);
      RCTPlatformView *rootView = [appDelegate.rootViewFactory viewWithModuleName:@"MoosiacProjects"
                                                                initialProperties:nil];
      rootView.frame = frame;

      sProjectsWindow = [[NSWindow alloc] initWithContentRect:frame
                                                      styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskResizable |
                                                                NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable
                                                        backing:NSBackingStoreBuffered
                                                          defer:NO];
      // Not localized: native code has no reach into i18n at the moment this
      // is first needed, which can be before any JS has run at all (launch).
      // A window chrome label this rarely seen is not worth a bridge call for.
      sProjectsWindow.title = @"Projects";
      sProjectsWindow.identifier = @"MoosiacProjectsWindow";
      sProjectsWindow.releasedWhenClosed = NO;
      NSViewController *rootViewController = [NSViewController new];
      rootViewController.view = rootView;
      sProjectsWindow.contentViewController = rootViewController;
      [sProjectsWindow center];
    }
    [sProjectsWindow makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
  });
}

RCT_EXPORT_METHOD(show)
{
  [MoosiacProjectsWindow showProjectsWindow];
}

RCT_EXPORT_METHOD(focusMain)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    RCTAppDelegate *appDelegate = (RCTAppDelegate *)[NSApplication sharedApplication].delegate;
    [appDelegate.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
  });
}

/*
  Dismissed by New/Template/Import landing a project, or by the reader's own
  click on the native close button — never by anything else this window
  draws, since it draws no close control of its own. `orderOut:`, not
  `close:` or `performClose:`: both of those still end up here anyway
  (AppKit's default close action), and ordering out directly is what
  `releasedWhenClosed = NO` already promised — hidden, not destroyed, so
  `show` next time brings back exactly what was on screen rather than a
  fresh mount that lost a half-typed sign-in field.
*/
RCT_EXPORT_METHOD(close)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [sProjectsWindow orderOut:nil];
  });
}

@end

/**
 * The system's pop-up menu, for a `Select`.
 *
 * `@sudobility/components-rn`'s `Select` opens its choices as an `NSMenu` on
 * a desktop when the app provides this module, and as a list it draws itself
 * when it does not. The drawn list works; this is what a Mac user expects
 * under a pop-up button, and it can extend past the window's edge where a
 * drawn one is clipped by it.
 *
 * Registered under the name the component looks for. Declared here rather
 * than in a file of its own for the reason the menu bridge above gives: a
 * second class in one `.mm` needs no new entry in the Xcode project.
 */
@interface MoosiacPopupMenu : NSObject <RCTBridgeModule>
@property (nonatomic, copy) NSString *selectedKey;
@end

@implementation MoosiacPopupMenu

RCT_EXPORT_MODULE(PopupMenuModule);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (void)menuItemClicked:(NSMenuItem *)sender
{
  self.selectedKey = sender.representedObject;
}

RCT_EXPORT_METHOD(show:(NSArray<NSDictionary *> *)items
                  screenX:(double)screenX
                  screenY:(double)screenY
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    self.selectedKey = nil;

    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    menu.autoenablesItems = NO;
    NSMenuItem *current = nil;
    for (NSDictionary *item in items) {
      if ([item[@"separator"] boolValue]) {
        [menu addItem:[NSMenuItem separatorItem]];
        continue;
      }
      NSMenuItem *menuItem = [[NSMenuItem alloc] initWithTitle:item[@"label"] ?: @""
                                                        action:@selector(menuItemClicked:)
                                                 keyEquivalent:@""];
      menuItem.target = self;
      menuItem.representedObject = item[@"key"];
      menuItem.enabled = YES;
      if ([item[@"selected"] boolValue]) {
        menuItem.state = NSControlStateValueOn;
        current = menuItem;
      }
      [menu addItem:menuItem];
    }

    /*
      The point arrives measured from the top-left of the window's content,
      which is where React Native counts from; AppKit counts from the bottom
      left of the screen. The key window, not the main one: this app has two,
      and a select is pressed in whichever is in front.
    */
    NSWindow *window = NSApp.keyWindow ?: NSApp.mainWindow;
    if (!window) {
      resolve([NSNull null]);
      return;
    }
    NSRect content = [window contentRectForFrameRect:window.frame];
    NSPoint location = NSMakePoint(content.origin.x + screenX,
                                   content.origin.y + content.size.height - screenY);

    // Blocks until the menu is dismissed. Opened with the current choice
    // under the pointer, as a pop-up button opens.
    [menu popUpMenuPositioningItem:current atLocation:location inView:nil];

    resolve(self.selectedKey ?: (id)[NSNull null]);
  });
}

@end

@implementation MoosiacDocumentController

- (void)openDocumentWithContentsOfURL:(NSURL *)url
                              display:(BOOL)displayDocument
                    completionHandler:(void (^)(NSDocument *, BOOL, NSError *))completionHandler
{
  /*
    Held for the rest of the run: JavaScript reads the file after this
    returns, and an entry reopened from a bookmark is only readable while its
    scope is open. Paired with nothing, as the file's scope ends with the
    process.
  */
  [url startAccessingSecurityScopedResource];
  [(AppDelegate *)NSApp.delegate application:NSApp openURLs:@[ url ]];
  completionHandler(nil, NO, nil);
}

@end
