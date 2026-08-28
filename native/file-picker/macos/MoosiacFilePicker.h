#import <React/RCTBridgeModule.h>

/**
 * `NSOpenPanel` and `NSSavePanel`, exposed to JavaScript.
 *
 * The sandbox is the reason this cannot be done from JS with a path: on a
 * sandboxed build an app may read only files the *user* chose through a panel,
 * so the panel is not a convenience — it is where the permission comes from.
 */
@interface MoosiacFilePicker : NSObject <RCTBridgeModule>
@end
