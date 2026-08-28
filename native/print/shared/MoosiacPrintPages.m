#import "MoosiacPrintPages.h"

@implementation MoosiacPrintPages

+ (NSArray<NSData *> *)dataFromPages:(NSArray<NSDictionary *> *)pages
{
  NSMutableArray<NSData *> *out = [NSMutableArray arrayWithCapacity:pages.count];
  for (NSDictionary *page in pages) {
    NSString *base64 = page[@"base64"];
    if (![base64 isKindOfClass:[NSString class]]) {
      continue;
    }
    NSData *data = [[NSData alloc] initWithBase64EncodedString:base64
                                                       options:0];
    if (data != nil) {
      [out addObject:data];
    }
  }
  return out;
}

@end
