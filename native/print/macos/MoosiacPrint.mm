#import "MoosiacPrint.h"
#import "MoosiacPrintPages.h"
#import "MoosiacPrintView.h"

#import <AppKit/AppKit.h>

@implementation MoosiacPrint

RCT_EXPORT_MODULE()

/** The print panel is AppKit, so it must be raised on the main thread. */
+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

/** Whether any of the app's windows still has a sheet attached. */
static BOOL MoosiacPrintSheetShowing(void)
{
  for (NSWindow *window in NSApp.windows) {
    if (window.attachedSheet != nil) return YES;
  }
  return NO;
}

/**
 * Runs `run` once the app's own print options sheet has gone.
 *
 * `runOperation` is modal and holds the main thread until the panel closes,
 * so started straight from the sheet's Print button it froze the app with
 * that sheet still drawn behind the system panel. A short first wait lets
 * React Native commit the sheet's closing; then every 50ms until no window
 * has a sheet attached, for two seconds at most.
 */
static void MoosiacPrintWhenSettled(NSInteger attemptsLeft, dispatch_block_t run)
{
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(100 * NSEC_PER_MSEC)),
                 dispatch_get_main_queue(), ^{
                   if (attemptsLeft > 0 && MoosiacPrintSheetShowing()) {
                     MoosiacPrintWhenSettled(attemptsLeft - 1, run);
                     return;
                   }
                   run();
                 });
}

RCT_EXPORT_METHOD(printPages:(NSString *)jobName
                  pages:(NSArray<NSDictionary *> *)pages
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  NSArray<NSData *> *data = [MoosiacPrintPages dataFromPages:pages];
  NSMutableArray<NSImage *> *images = [NSMutableArray arrayWithCapacity:data.count];
  for (NSData *png in data) {
    NSImage *image = [[NSImage alloc] initWithData:png];
    if (image != nil) {
      [images addObject:image];
    }
  }
  if (images.count == 0) {
    reject(@"no_pages", @"There was nothing to print.", nil);
    return;
  }

  NSPrintInfo *info = [[NSPrintInfo sharedPrintInfo] copy];
  /*
    No margins of our own: the score was already laid out with
    `PAGE_MARGIN_MM` inside the printable area, and adding AppKit's default
    inch on top would shrink the music to fit twice.
  */
  info.leftMargin = 0;
  info.rightMargin = 0;
  info.topMargin = 0;
  info.bottomMargin = 0;
  info.horizontalPagination = NSPrintingPaginationModeFit;
  info.verticalPagination = NSPrintingPaginationModeFit;

  NSSize pageSize = info.paperSize;
  MoosiacPrintView *view = [[MoosiacPrintView alloc] initWithImages:images
                                                          pageSize:pageSize];

  NSPrintOperation *operation = [NSPrintOperation printOperationWithView:view
                                                              printInfo:info];
  operation.jobTitle = jobName.length > 0 ? jobName : @"Score";
  operation.showsPrintPanel = YES;
  operation.showsProgressPanel = YES;

  // Cancelling the panel returns NO, which is an ordinary outcome rather than
  // an error — the same contract the iOS side has.
  MoosiacPrintWhenSettled(20, ^{
    resolve(@([operation runOperation]));
  });
}

@end
