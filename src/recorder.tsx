import * as React from "react";

import {Utils} from "ractive-player";
const {bind} = Utils.misc;
import {ReplayDataRecorder, RecorderPlugin} from "rp-recording";

import type {EditorView, keymap} from "@codemirror/view";

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
  constructor() {
    super();
    bind(this, ["extension"]);
  }

  extension($cm: {
    EditorView: typeof EditorView;
    keymap: typeof keymap;
  }, keys: string[] = []) {
    // record document changes
    const updateListener = $cm.EditorView.updateListener.of(update => {
      if (!this.manager || this.manager.paused || !this.manager.active)
        return;

      // get selection change (if any)
      const transactions =
        update.transactions
        .map(t => {
          if (!t.selection)
            return false;
          const range = t.selection.ranges[0];
          return [range.anchor, range.head];
        })
        .filter(Boolean)
        .slice(-1);

      this.capture(this.manager.getTime(), [
        update.changes,
        ...transactions
      ]);
    });

    // record special key presses
    const keyListener = $cm.keymap.of(
      keys.map(key => ({
        key,
        run: () => {
          if (!this.manager || this.manager.paused || !this.manager.active)
            return false;
          this.capture(this.manager.getTime(), key);
          return false;
        }
      }))
    );

    return [updateListener, keyListener];
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
  enabled: () => true,
  icon,
  key: "rp-codemirror",
  name: "Code",
  recorder: recorder,
  saveComponent: KeySaveComponent,
  title: "Record code"
} as RecorderPlugin<CaptureData>;

// function formatNum(x: number): number {
//   return parseFloat(x.toFixed(2));
// }
