#import "ReactNativeSdk.h"

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
