#import "ReactNativeSdk.h"

// Xcode auto-generates this umbrella header for the Swift files compiled
// into the same target/pod (see ReactNativeSdk.podspec's `swift_version`).
// NOT verified in this environment -- no Xcode/macOS available here. See
// README "What could not be built/verified in this environment."
#if __has_include("ReactNativeSdk-Swift.h")
#import "ReactNativeSdk-Swift.h"
#else
#import <ReactNativeSdk/ReactNativeSdk-Swift.h>
#endif

static const double kCaneViewScannerDebounceMs = 400.0;

@implementation ReactNativeSdk {
  CaneViewScanner *_scanner;
}

- (instancetype)init
{
  if (self = [super init]) {
    _scanner = [[CaneViewScanner alloc] initWithDebounceMs:kCaneViewScannerDebounceMs];
  }
  return self;
}

/**
 * Bridges to `captureViewHierarchy(): Promise<CapturedElementNative[]>`.
 *
 * Fail-safe contract: this NEVER rejects. Any native-side failure resolves
 * with an empty array so the JS layer degrades gracefully instead of
 * surfacing a native crash/error to the host app.
 */
- (void)captureViewHierarchy:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  @try {
    [_scanner scanWithCompletion:^(NSArray<NSDictionary<NSString *, id> *> * _Nonnull results) {
      resolve(results);
    }];
  } @catch (NSException *exception) {
    resolve(@[]);
  }
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeReactNativeSdkSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"ReactNativeSdk";
}

@end
