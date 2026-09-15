/**
 * The playback caret, moved on the main thread by the display link.
 *
 * JavaScript describes the motion — a tick → x function for the system being
 * played (its knots), where the playhead was at a moment, and how fast it is
 * advancing — and this view draws the line from that description every frame.
 * A new description arrives only when the motion changes: a new system, a
 * seek, a pause, a tempo change, or drift from the engine's reports. Nothing
 * per frame crosses from JavaScript, which is the point: on the Mac every
 * JS-driven caret write is a Fabric commit on the JavaScript thread, and a
 * busy thread made the caret stop and jump.
 *
 * `useNativeDriver` animations would be the stock way to get this, and they do
 * not reach views on this react-native-macos build — measured: a native-driven
 * opacity loop never changed the view at all.
 */
#import <QuartzCore/QuartzCore.h>
#import <React/RCTConvert.h>
#import <React/RCTUIKit.h>
#import <React/RCTViewManager.h>

#include <chrono>

/** `performance.now()` in milliseconds: JavaScript's clock is `steady_clock` too. */
static double SteadyNowMs()
{
  using namespace std::chrono;
  return duration<double, std::milli>(steady_clock::now().time_since_epoch()).count();
}

@interface MoosiacPlayheadView : RCTUIView

@property (nonatomic, copy) NSArray<NSNumber *> *knotTicks;
@property (nonatomic, copy) NSArray<NSNumber *> *knotXs;
@property (nonatomic, assign) CGFloat lineTop;
@property (nonatomic, assign) CGFloat lineHeight;
@property (nonatomic, assign) CGFloat lineWidth;
@property (nonatomic, strong) NSColor *lineColor;
@property (nonatomic, assign) double anchorTick;
@property (nonatomic, assign) double anchorTime;
@property (nonatomic, assign) double rate;
@property (nonatomic, assign) double planId;
@property (nonatomic, assign) CGFloat clipLeft;
@property (nonatomic, assign) double sentAt;
@property (nonatomic, assign) CGFloat scrollLeft;

@end

@implementation MoosiacPlayheadView {
  CALayer *_line;
  CADisplayLink *_displayLink;
  std::vector<double> _ticks;
  std::vector<double> _xs;
  /** The anchor on this process's steady clock, in milliseconds. */
  double _anchorMs;
  BOOL _needsAnchor;
}

- (instancetype)initWithFrame:(NSRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    self.wantsLayer = YES;
    _line = [CALayer layer];
    _line.anchorPoint = CGPointZero;
    _line.hidden = YES;
    [self.layer addSublayer:_line];
    _lineWidth = 2;
    _lineColor = NSColor.systemRedColor;
  }
  return self;
}

- (BOOL)isFlipped
{
  return YES;
}

/** The caret is a picture of the playhead, never something to click. */
- (NSView *)hitTest:(NSPoint)point
{
  return nil;
}

- (void)setKnotTicks:(NSArray<NSNumber *> *)knotTicks
{
  _knotTicks = [knotTicks copy];
  _ticks.clear();
  for (NSNumber *tick in knotTicks) {
    _ticks.push_back(tick.doubleValue);
  }
}

- (void)setKnotXs:(NSArray<NSNumber *> *)knotXs
{
  _knotXs = [knotXs copy];
  _xs.clear();
  for (NSNumber *x in knotXs) {
    _xs.push_back(x.doubleValue);
  }
}

- (void)setAnchorTick:(double)anchorTick
{
  _anchorTick = anchorTick;
  _needsAnchor = YES;
}

- (void)setAnchorTime:(double)anchorTime
{
  _anchorTime = anchorTime;
  _needsAnchor = YES;
}

- (void)setRate:(double)rate
{
  _rate = rate;
  _needsAnchor = YES;
}

- (void)setSentAt:(double)sentAt
{
  _sentAt = sentAt;
  _needsAnchor = YES;
}

- (void)setPlanId:(double)planId
{
  _planId = planId;
  _needsAnchor = YES;
}

- (void)didSetProps:(NSArray<NSString *> *)changedProps
{
  if (_needsAnchor) {
    _needsAnchor = NO;
    /*
      JavaScript's `performance.now()` is `steady_clock` too, so an anchor can
      be used as it stands — including one set seconds ago, which is what a
      path swap at a system break re-sends. `sentAt` is JavaScript's clock when
      these props were rendered: were the two clocks ever to differ, the gap
      between it and ours says by how much, and a real delivery delay is far
      smaller than the second this tolerates.
    */
    double offset = SteadyNowMs() - _sentAt;
    _anchorMs = _anchorTime + (fabs(offset) > 1000 ? offset : 0);
  }
  _line.backgroundColor = _lineColor.CGColor;
  [self updateDisplayLink];
  [self draw];
}

- (void)viewDidMoveToWindow
{
  [super viewDidMoveToWindow];
  [self updateDisplayLink];
}

- (void)updateDisplayLink
{
  BOOL wanted = self.window != nil && _rate > 0 && _ticks.size() >= 2;
  if (wanted && _displayLink == nil) {
    _displayLink = [self displayLinkWithTarget:self selector:@selector(step:)];
    [_displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
  } else if (!wanted && _displayLink != nil) {
    [_displayLink invalidate];
    _displayLink = nil;
  }
}

- (void)removeFromSuperview
{
  [_displayLink invalidate];
  _displayLink = nil;
  [super removeFromSuperview];
}

- (void)step:(CADisplayLink *)link
{
  [self draw];
}

/** `cursorXAt` in music_drawing's cursor.ts: linear between knots, clamped at the ends. */
- (double)xForTick:(double)tick
{
  if (tick <= _ticks.front()) return _xs.front();
  if (tick >= _ticks.back()) return _xs.back();
  auto upper = std::upper_bound(_ticks.begin(), _ticks.end(), tick);
  size_t hi = upper - _ticks.begin();
  size_t lo = hi - 1;
  double span = _ticks[hi] - _ticks[lo];
  if (span <= 0) return _xs[hi];
  return _xs[lo] + (tick - _ticks[lo]) / span * (_xs[hi] - _xs[lo]);
}

- (void)draw
{
  if (_ticks.empty() || _ticks.size() != _xs.size() || _lineHeight <= 0) {
    _line.hidden = YES;
    return;
  }
  double elapsed = MAX(0, (SteadyNowMs() - _anchorMs) / 1000.0);
  double tick = _anchorTick + _rate * elapsed;
  double x = [self xForTick:tick];
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  // `cursorVisible`: hidden while under the track-info gutter.
  _line.hidden = x - _scrollLeft < _clipLeft;
  // `x` is the centre of the line.
  _line.frame = CGRectMake(x - _lineWidth / 2, _lineTop, _lineWidth, _lineHeight);
  [CATransaction commit];
}

@end

@interface MoosiacPlayheadManager : RCTViewManager
@end

@implementation MoosiacPlayheadManager

RCT_EXPORT_MODULE(MoosiacPlayhead)

- (RCTUIView *)view
{
  return [MoosiacPlayheadView new];
}

RCT_EXPORT_VIEW_PROPERTY(knotTicks, NSArray)
RCT_EXPORT_VIEW_PROPERTY(knotXs, NSArray)
RCT_EXPORT_VIEW_PROPERTY(lineTop, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(lineHeight, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(lineWidth, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(lineColor, NSColor)
RCT_EXPORT_VIEW_PROPERTY(anchorTick, double)
RCT_EXPORT_VIEW_PROPERTY(anchorTime, double)
RCT_EXPORT_VIEW_PROPERTY(rate, double)
RCT_EXPORT_VIEW_PROPERTY(planId, double)
RCT_EXPORT_VIEW_PROPERTY(clipLeft, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(sentAt, double)
RCT_EXPORT_VIEW_PROPERTY(scrollLeft, CGFloat)

@end
