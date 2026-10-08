#import <AppKit/AppKit.h>
#import <React/RCTView.h>
#import <React/RCTViewManager.h>

// The legacy macOS renderer does not deliver mouse drags through RN's pointer
// or touch responders on this canvas. This view forwards the actual AppKit
// mouse sequence, including mouse-up, to the shared stage drag calculation.
@interface SpatialMouseDragView : RCTView
@property (nonatomic, copy) RCTDirectEventBlock onSpatialDragStart;
@property (nonatomic, copy) RCTDirectEventBlock onSpatialDragMove;
@property (nonatomic, copy) RCTDirectEventBlock onSpatialDragEnd;
@end

@implementation SpatialMouseDragView

- (BOOL)acceptsFirstMouse:(NSEvent *)event
{
  return YES;
}

- (NSDictionary *)positionForEvent:(NSEvent *)event
{
  NSPoint point = [self convertPoint:event.locationInWindow fromView:nil];
  return @{ @"x": @(point.x) };
}

- (void)mouseDown:(NSEvent *)event
{
  if (self.onSpatialDragStart) {
    self.onSpatialDragStart([self positionForEvent:event]);
  }
}

- (void)mouseDragged:(NSEvent *)event
{
  if (self.onSpatialDragMove) {
    self.onSpatialDragMove([self positionForEvent:event]);
  }
}

- (void)mouseUp:(NSEvent *)event
{
  if (self.onSpatialDragEnd) {
    self.onSpatialDragEnd([self positionForEvent:event]);
  }
}

@end

@interface SpatialMouseDragViewManager : RCTViewManager
@end

@implementation SpatialMouseDragViewManager

RCT_EXPORT_MODULE(SpatialMouseDragView)

- (NSView *)view
{
  return [SpatialMouseDragView new];
}

RCT_EXPORT_VIEW_PROPERTY(onSpatialDragStart, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onSpatialDragMove, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onSpatialDragEnd, RCTDirectEventBlock)

@end
