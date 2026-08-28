#import "MoosiacFilePicker.h"

#import <AppKit/AppKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

@implementation MoosiacFilePicker

RCT_EXPORT_MODULE()

/**
 * Panels are AppKit, so they must be raised on the main thread.
 *
 * Returning NO here would let React Native call these on its own queue, where
 * `runModal` deadlocks rather than failing — the app simply stops.
 */
+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

/** The panel's allowed types, from bare extensions like `mid`. */
static NSArray<UTType *> *TypesForExtensions(NSArray<NSString *> *extensions)
{
  NSMutableArray<UTType *> *types = [NSMutableArray array];
  for (NSString *extension in extensions) {
    UTType *type = [UTType typeWithFilenameExtension:extension];
    if (type != nil) {
      [types addObject:type];
    }
  }
  return types;
}

RCT_EXPORT_METHOD(pickFile:(NSArray<NSString *> *)extensions
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  NSOpenPanel *panel = [NSOpenPanel openPanel];
  panel.canChooseFiles = YES;
  panel.canChooseDirectories = NO;
  panel.allowsMultipleSelection = NO;
  NSArray<UTType *> *types = TypesForExtensions(extensions);
  if (types.count > 0) {
    panel.allowedContentTypes = types;
  }

  // Cancelling is an ordinary outcome, not an error: a promise rejection here
  // would make every caller wrap a plain "changed my mind" in a try.
  if ([panel runModal] != NSModalResponseOK || panel.URL == nil) {
    resolve([NSNull null]);
    return;
  }
  resolve(panel.URL.path);
}

RCT_EXPORT_METHOD(pickSaveLocation:(NSString *)suggestedName
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  NSSavePanel *panel = [NSSavePanel savePanel];
  if (suggestedName.length > 0) {
    panel.nameFieldStringValue = suggestedName;
    UTType *type = [UTType typeWithFilenameExtension:suggestedName.pathExtension];
    if (type != nil) {
      panel.allowedContentTypes = @[ type ];
    }
  }

  if ([panel runModal] != NSModalResponseOK || panel.URL == nil) {
    resolve([NSNull null]);
    return;
  }
  resolve(panel.URL.path);
}

@end
