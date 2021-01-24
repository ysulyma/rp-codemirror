import {Player} from "ractive-player";
import {Recorder, RecorderPlugin} from "rp-recording";
import {CodeEditor} from "./rp-codemirror";

// recorder
interface KeyRecorderStatic {
  connect(editor: CodeEditor): void;
  disconnect(): void;
  new(player: Player): Recorder;
}

declare const _default: RecorderPlugin;
export default _default;
