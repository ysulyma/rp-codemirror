import * as React from "react";
import {Player, ReplayData} from "ractive-player";

import type {EventEmitter} from "events";
import {StrictEventEmitter} from "strict-event-emitter-types";

import {ChangeSet, Extension} from "@codemirror/state";
import {DOMEventHandlers, EditorView, KeyBinding, PluginValue} from "@codemirror/view";

export = RPCodeMirror;
export as namespace RPCodeMirror;

declare namespace RPCodeMirror {
  function passThrough(player: Player, seqs?: string[]): KeyBinding[];

  function suspendControls(player: Player): DOMEventHandlers<unknown>;
}
