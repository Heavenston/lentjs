import { listenForSignalReads, registerSignalCallback, type SignalCallback, type SignalId } from "./signal-internal";

declare const CapturedReactivityData: unique symbol;
export type CapturedReactivityData = Readonly<{ [CapturedReactivityData]: "capturedReactionReactivityData", length: number }>;

function convertReactivityData<T>(val: T): T extends CapturedReactivityData ? SignalId[] : T extends SignalId[] ? CapturedReactivityData : T {
  // @ts-ignore
  return val;
}

export type UnsubscribeReaction = () => CapturedReactivityData;

function internalCreateOrResumeReaction(reaction: () => void, resumeWithSignalReads?: SignalId[]): UnsubscribeReaction {
  let latestReactiveCallback: SignalCallback | null = null;
  let latestSignalReads: SignalId[] = [];

  const callAndSub = () => {
    if (latestReactiveCallback) latestReactiveCallback.onUpdate = null;

    const signalReads: SignalId[] = [];
    listenForSignalReads(reaction, signalReads);
    latestSignalReads = signalReads;
    latestReactiveCallback = { onUpdate: callAndSub };
    for (const signalId of signalReads)
      registerSignalCallback(latestReactiveCallback, signalId);
  };
  
  if (resumeWithSignalReads) {
    latestReactiveCallback = { onUpdate: callAndSub };
    for (const signalId of resumeWithSignalReads)
      registerSignalCallback(latestReactiveCallback, signalId);
  }
  else {
    callAndSub();
  }

  return () => {
    if (latestReactiveCallback)
      latestReactiveCallback.onUpdate = null;
    return convertReactivityData(latestSignalReads);
  }
}

export function createReaction(reaction: () => void): UnsubscribeReaction {
  return internalCreateOrResumeReaction(reaction);
}

export function resumeReaction(reaction: () => void, reactivityData: CapturedReactivityData): UnsubscribeReaction {
  return internalCreateOrResumeReaction(reaction, convertReactivityData(reactivityData));
}

export function startReaction<T>(reaction: () => T): [T, CapturedReactivityData] {
  const signalReads: SignalId[] = [];
  const val = listenForSignalReads(reaction, signalReads);
  return [val, convertReactivityData(signalReads)];
}

