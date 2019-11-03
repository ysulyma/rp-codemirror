import * as CodeMirror from "codemirror";
import * as React from "react";
import {ReplayData} from "ractive-player";

export = RPCodeMirror;
export as namespace RPCodeMirror;

// CodeEditor
interface CodeEditorProps {
  keyMap?: {
    [key: string]: () => unknown;
  };
  mode?: string;
  readOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
  theme?: string;
}

// CodeReplay
interface Change {
  from: CodeMirror.Position;
  to: CodeMirror.Position;
  text: string[];
  removed: string[];
}

interface CMSelection {
  anchor: CodeMirror.Position;
  head: CodeMirror.Position;
}

interface CodeReplayProps {
  command: (dir: "fwd" | "back", data: string, state: CRState) => void;
  mode?: string;
  replay: RPCodeMirror.CaptureData;
  start: number | string;
  className?: string;
  style?: React.CSSProperties;
  theme?: string;
}

interface CRState {
  cursor: CodeMirror.Position;
  selection: CMSelection;
  value: string[];
}

declare namespace RPCodeMirror {
  type CaptureData = ReplayData<
  ["command", string] |
  ["cursor", CodeMirror.Position] |
  ["selection", CMSelection] |
  ["text", Change]
  >;

  class CodeEditor extends React.Component<CodeEditorProps> {
    editor: CodeMirror.Editor;
    ready: Promise<void>;
  }

  class CodeReplay extends React.Component<CodeReplayProps> {
    static contextType: typeof Player.Context;

    codeEditor: CodeEditor;
    cursor: HTMLDivElement;
    cursorDiv: HTMLDivElement;
    cursorState: CodeMirror.Position;
    duration: number;
    selectionsDiv: HTMLDivElement;
    start: number;
  }
}
