import {Player} from "liqvid";
import {Recorder, RecorderPlugin} from "rp-recording";

import {Extension} from "@codemirror/state";
import {EditorView} from "@codemirror/view";

// recorder
interface KeyRecorderStatic {
  new(player: Player): Recorder;
  extension(dep: EditorView): Extension;
}

declare const _default: RecorderPlugin;
export default _default;
