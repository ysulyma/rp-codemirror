import * as React from "react";
import {useMemo, useState} from "react";
import * as CodeMirror from "codemirror";

import {Utils, ReplayData} from "ractive-player";
const {bind} = Utils.misc,
      {onClick} = Utils.mobile;
import {ReplayDataRecorder, RecorderPlugin} from "rp-recording";

import CodeEditor from "./CodeEditor";

interface CMSelection {
  anchor: CodeMirror.Position;
  head: CodeMirror.Position;
}

interface Change {
  from: CodeMirror.Position;
  to: CodeMirror.Position;
  text: string[];
  removed: string[];
}

type CaptureData = 
  ["command", string] |
  ["cursor", CodeMirror.Position] |
  ["selection", CMSelection] |
  ["text", Change];

const icon = (
  <g transform="scale(0.5333333333)">
    <g transform="translate(-138.61 -857.23)">
      <rect
        style={{
          strokeLinejoin: "round",
          stroke: "#FFF",
          strokeLinecap: "round",
          strokeWidth: 3.8521,
          fill: "#FFF"
        }}
        rx="9.4681"
        ry="14.97"
        height="58.455"
        width="121.82"
        y="931.93"
        x="171.45"
      />
      <path
        style={{
          stroke: "#000",
          strokeDasharray: "4.9175124 4.9175124",
          strokeWidth: 4.9175,
          fill: "none"
        }}
        d="m184.06 947.36h94.08"
      />
      <path
        style={{
          stroke:"#000",
          strokeDasharray: "4.9175124 4.9175124",
          strokeWidth: 4.9175,
          fill:"none"
        }}
        d="m184.06 957.05h94.08"
      />
      <path
        style={{
          stroke: "#000",
          strokeDasharray: "4.9175124 4.9175124",
          strokeWidth: 4.9175,
          fill: "none"
        }}
        d="m184.06 966.75h94.08"
      />
      <path
        style={{
          stroke: "#FFF",
          strokeWidth: 4.9175,
          fill: "none"
        }}
        d="m184.06 977.23h94.08"
      />
      <path
        style={{
          stroke: "#FFF",
          strokeLinecap: "round",
          strokeWidth: 4.3986,
          fill: "none"
        }}
        d="m278.67 929.84s8.86-13.98-0.31-21.47c-10.76-8.79-20.81 8.66-36.55-3.07"
      />
    </g>
  </g>
);

// the actual thingy that gets exported
class KeyRecorder extends ReplayDataRecorder<CaptureData> {
  private cm: CodeMirror.Editor;
  connectedEditor: CodeEditor;

  constructor() {
    super();
    bind(this, ["captureCursor", "captureKey", "captureKeySequence"]);
  }

  connect(codeEditor: CodeEditor) {
    this.connectedEditor = codeEditor;
  }

  disconnect() {
    this.connectedEditor = null;
  }

  beginRecording() {
    // DO NOT FORGET TO CALL SUPER
    super.beginRecording();
    const cm = this.connectedEditor.editor;
    cm.on("change", this.captureKey);
    cm.on("cursorActivity", this.captureCursor);
    cm.on("keyHandled", this.captureKeySequence);
  }

  endRecording() {
    const cm = this.connectedEditor.editor;
    cm.off("change", this.captureKey);
    cm.off("cursorActivity", this.captureCursor);
    cm.off("keyHandled", this.captureKeySequence);
  }

  captureCursor(cm: CodeMirror.Editor) {
    const time = this.manager.getTime();

    if (this.manager.paused)
      return;

    const selection = cm.getDoc().listSelections()[0],
          anchor = whitelist(selection.anchor, ["line", "ch"]),
          head = whitelist(selection.head, ["line", "ch"]);

    if (anchor.line === head.line && anchor.ch === head.ch) {
      this.capture(time, ["cursor", whitelist(anchor, ["line", "ch"])]);
    } else {
      this.capture(time, ["selection", {anchor, head}]);
    }
  };

  captureKey(cm: CodeMirror.Editor, {from, to, text, removed}: CodeMirror.EditorChange) {
    const time = this.manager.getTime();

    if (this.manager.paused)
      return;

    this.capture(time, [
      "text",
      {
        from: whitelist(from, ["line", "ch"]),
        to: whitelist(to, ["line", "ch"]),
        text,
        removed
      }
    ]);
  }

  captureKeySequence(cm: CodeMirror.Editor, sequence: string) {
    const time = this.manager.getTime();
    if (sequence.startsWith("Cmd-Alt-"))
      return;

    if (this.manager.paused)
      return;

    this.capture(time, ["command", sequence]);
  }
}

/* helper functions */
// function lookupKeyForEditor(cm, name, handle) {
//   for (let i = 0; i < cm.state.keyMaps.length; i++) {
//     const result = CodeMirror.lookupKey(name, cm.state.keyMaps[i], handle, cm);
//     if (result) return result;
//   }
//   return (cm.options.extraKeys && CodeMirror.lookupKey(name, cm.options.extraKeys, handle, cm))
//     || CodeMirror.lookupKey(name, cm.options.keyMap, handle, cm)
// }

function KeySaveComponent(props: {data: CaptureData}) {
  return (
    <>
      <textarea readOnly value={JSON.stringify(props.data)}></textarea>
    </>
  );
}

const recorder = new KeyRecorder();
export default {
  enabled: () => !!recorder.connectedEditor,
  icon,
  key: "rp-codemirror",
  name: "Code",
  recorder: recorder,
  saveComponent: KeySaveComponent,
  title: "Record code"
} as RecorderPlugin<CaptureData>;

function formatNum(x: number): number {
  return parseFloat(x.toFixed(2));
}

function whitelist<T, K extends keyof T>(obj: T, keys: K[]) {
  const ret = {} as Pick<T, typeof keys[number]>;
  for (const key of keys) {
    if (key in obj)
      ret[key] = obj[key];
  }

  return ret;
}
