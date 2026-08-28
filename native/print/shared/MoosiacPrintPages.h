#import <Foundation/Foundation.h>

/**
 * Decoding the pages JavaScript sends.
 *
 * Shared by both Apple platforms because the wire format is the same — the
 * difference is only what each one does with the images afterwards.
 */
@interface MoosiacPrintPages : NSObject

/**
 * The PNG data for each page, in order.
 *
 * A page whose base64 does not decode is skipped rather than substituted:
 * printing a blank where music should be is worse than printing a shorter
 * part, because only one of those is noticeable.
 */
+ (NSArray<NSData *> *)dataFromPages:(NSArray<NSDictionary *> *)pages;

@end
