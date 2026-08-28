#import <AppKit/AppKit.h>

/**
 * A view whose pages are images.
 *
 * `NSPrintOperation` prints a *view*: it asks how many pages there are, where
 * each one sits, and then calls `drawRect:` with the print graphics context
 * for each in turn. AppKit serialises the result — which is why the app hands
 * over drawings rather than a document.
 */
@interface MoosiacPrintView : NSView

- (instancetype)initWithImages:(NSArray<NSImage *> *)images
                      pageSize:(NSSize)pageSize;

@end
