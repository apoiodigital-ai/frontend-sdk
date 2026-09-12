/**
 * Tiny indirection layer so `CaneSDKHost` (the render anchor) and
 * `CaneSDK` (the imperative facade) don't need to import each other
 * directly. Both depend on this leaf module instead, which avoids an
 * import cycle between the two.
 */
interface CaneSDKInternal {
  notifyUserActivity: () => void;
}

export const caneSDKInternal: CaneSDKInternal = {
  notifyUserActivity: () => {
    // no-op until `CaneSDK.init()` wires the real handler in.
  },
};
