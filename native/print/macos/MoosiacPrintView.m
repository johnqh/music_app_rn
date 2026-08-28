#import "MoosiacPrintView.h"

@interface MoosiacPrintView ()
@property(nonatomic, copy) NSArray<NSImage *> *images;
@property(nonatomic, assign) NSSize pageSize;
@end

@implementation MoosiacPrintView

- (instancetype)initWithImages:(NSArray<NSImage *> *)images
                      pageSize:(NSSize)pageSize
{
  /*
    The view is as tall as every page stacked. `rectForPage:` then carves it
    back up, which is the shape AppKit expects: one continuous view, sliced.
  */
  NSRect frame = NSMakeRect(0, 0, pageSize.width,
                            pageSize.height * (CGFloat)images.count);
  self = [super initWithFrame:frame];
  if (self != nil) {
    _images = [images copy];
    _pageSize = pageSize;
  }
  return self;
}

/**
 * Top-left origin, matching how the pages were drawn.
 *
 * AppKit's default is bottom-left, which would print the pages upside down in
 * order — the last one first, each one mirrored vertically.
 */
- (BOOL)isFlipped
{
  return YES;
}

- (BOOL)knowsPageRange:(NSRangePointer)range
{
  range->location = 1;
  range->length = self.images.count;
  return YES;
}

- (NSRect)rectForPage:(NSInteger)page
{
  // 1-based, as AppKit numbers them.
  return NSMakeRect(0, self.pageSize.height * (CGFloat)(page - 1),
                    self.pageSize.width, self.pageSize.height);
}

- (void)drawRect:(NSRect)dirtyRect
{
  [[NSColor whiteColor] setFill];
  NSRectFill(dirtyRect);

  NSUInteger first = (NSUInteger)floor(NSMinY(dirtyRect) / self.pageSize.height);
  NSUInteger last = (NSUInteger)ceil(NSMaxY(dirtyRect) / self.pageSize.height);
  for (NSUInteger i = first; i < MIN(last, self.images.count); i++) {
    NSRect target = NSMakeRect(0, self.pageSize.height * (CGFloat)i,
                               self.pageSize.width, self.pageSize.height);
    [self.images[i] drawInRect:target
                      fromRect:NSZeroRect
                     operation:NSCompositingOperationSourceOver
                      fraction:1.0];
  }
}

@end
