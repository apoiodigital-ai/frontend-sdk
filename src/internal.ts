interface CaneSDKInternal {
  notifyUserActivity: () => void;
}

export const caneSDKInternal: CaneSDKInternal = {
  notifyUserActivity: () => {},
};
