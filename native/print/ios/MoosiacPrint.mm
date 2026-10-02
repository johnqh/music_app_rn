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

/**
 * Whether a view controller is still on screen over the app, or on its way off.
 *
 * The print sheet is raised from a Print button inside the app's own print
 * options sheet, which closes as it is pressed. Presented while that sheet was
 * still animating away, UIKit hung the print controller off the departing
 * sheet and took both down together, leaving the window black with nothing to
 * tap — measured on an iPhone 18 Pro simulator, where the same job printed
 * straight from the editor presented normally.
 */
static BOOL MoosiacPrintBusy(UIViewController *controller)
{
  if (controller == nil) return NO;
  if (controller.isBeingDismissed || controller.isBeingPresented) return YES;
  // React Native presents its modals from the screen's own controller, deep
  // inside the navigation stack, not from the window's root — so the whole
  // tree is walked, not just the root's presented chain.
  if (controller.presentedViewController != nil) return YES;
  for (UIViewController *child in controller.childViewControllers) {
    if (MoosiacPrintBusy(child)) return YES;
  }
  return NO;
}

static BOOL MoosiacPrintSomethingPresented(void)
{
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:[UIWindowScene class]]) continue;
    for (UIWindow *window in ((UIWindowScene *)scene).windows) {
      if (!window.isKeyWindow) continue;
      if (MoosiacPrintBusy(window.rootViewController)) return YES;
    }
  }
  return NO;
}

/**
 * Runs `present` once nothing is presented over the app, checking every
 * 50ms. The first check waits a beat as well: the JS side closes its sheet
 * and asks for the print in one go, so the sheet may not have begun leaving
 * when this arrives. After two seconds it presents regardless, rather than
 * leave a print that never appears.
 */
static void MoosiacPrintWhenSettled(NSInteger attemptsLeft, dispatch_block_t present)
{
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(50 * NSEC_PER_MSEC)),
                 dispatch_get_main_queue(), ^{
                   if (attemptsLeft > 0 && MoosiacPrintSomethingPresented()) {
                     MoosiacPrintWhenSettled(attemptsLeft - 1, present);
                     return;
                   }
                   present();
                 });
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

  MoosiacPrintWhenSettled(40, ^{
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
  });
}

@end
