import * as React from "react";
import {Player, ReplayData} from "ractive-player";

import type {EventEmitter} from "events";
import {StrictEventEmitter} from "strict-event-emitter-types";

import {ChangeSet, Extension} from "@codemirror/state";
import {EditorView} from "@codemirror/view";

export = RPCodeMirror;
export as namespace RPCodeMirror;

declare namespace RPCodeMirror {
  function cmReplay(args: {
    ChangeSet: typeof ChangeSet;
    data: ReplayData<unknown[]>;
    handle?: (key: string) => void;
    playback: StrictEventEmitter<EventEmitter, {
      "timeupdate": number;
    }>;
    start: number;
    view: EditorView;
  }): Extension;

  const fakeSelection: Extension;
}
