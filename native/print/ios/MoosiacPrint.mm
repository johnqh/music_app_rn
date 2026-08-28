#import "MoosiacPrint.h"
#import "MoosiacPrintPages.h"

#import <UIKit/UIKit.h>

@implementation MoosiacPrint

RCT_EXPORT_MODULE()

/**
 * The print sheet is UIKit, so it must be raised on the main thread.
 *
 * Returning NO would let React Native call this on its own queue, where
 * presenting a view controller is undefined rather than merely wrong.
 */
+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(printPages:(NSString *)jobName
                  pages:(NSArray<NSDictionary *> *)pages
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  NSArray<NSData *> *images = [MoosiacPrintPages dataFromPages:pages];
  if (images.count == 0) {
    reject(@"no_pages", @"There was nothing to print.", nil);
    return;
  }

  UIPrintInteractionController *controller =
      [UIPrintInteractionController sharedPrintController];

  UIPrintInfo *info = [UIPrintInfo printInfo];
  info.jobName = jobName.length > 0 ? jobName : @"Score";
  // Photo output would apply a photographic colour profile to what is, on
  // paper, black line art — General is what a document wants.
  info.outputType = UIPrintInfoOutputGeneral;
  controller.printInfo = info;

  /*
    `printingItems` takes the page images directly: UIKit lays each one onto a
    sheet and produces the document itself. This is the whole reason the app
    needs no PDF writer.
  */
  controller.printingItems = images;

  [controller presentAnimated:YES
            completionHandler:^(UIPrintInteractionController *_Nonnull c,
                                BOOL completed,
                                NSError *_Nullable error) {
              if (error != nil) {
                reject(@"print_failed", error.localizedDescription, error);
                return;
              }
              // Cancelling is an ordinary outcome, not an error.
              resolve(@(completed));
            }];
}

@end
