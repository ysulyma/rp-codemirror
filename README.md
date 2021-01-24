# rp-codemirror

[CodeMirror](https://codemirror.net/) plugin for [ractive-player](https://github.com/ysulyma/ractive-player)/[rp-recording](https://github.com/ysulyma/rp-recording/).

## Installation

    $ npm install rp-codemirror

## Usage

To record:

```tsx
import {useEffect, useMemo} from "react";
import {Player, Script} from "ractive-player";

import {CodeEditor} from "rp-codemirror";
import CodeRecorderPlugin from "rp-codemirror/recorder";

const controls = (<>
  {Player.defaultControlsLeft}

  <div className="rp-controls-right">
    <RecordingControl plugins={[CodeRecorderPlugin]}/>

    {Player.defaultControlsRight}
  </div>
</>);

<Player controls={controls} script={script}>
  <MyComponent/>
</Player>

function MyComponent() {
  const codeEditor = useRef<CodeEditor>(); 

  /* recording */
  useEffect(() => {
    codeEditor.current.ready.then(() => {
      CodeRecorderPlugin.recorder.connect(codeEditor.current);
    });
  }, []);

  const keyMap = useMemo(() => ({
    "Ctrl-Enter": (e) => {/* ... */}
  }), []);

  return (
    <CodeEditor
      className={"code-editor"}
      keyMap={keyMap}
      mode={"javascript"}
      ref={codeEditor}
      theme="default"
    />
  );
}
```

To replay:

```tsx
import {useCallback, useMemo} from "react";

import {CodeReplay} from "rp-codemirror";

import {codeRecording} from "./recordings";

function MyComponent() {
  const replayCommand = useCallback((dir: "fwd" | "back", sequence: string, state) => {
    if (dir === "fwd") {
      /* do sequence */
    } else {
      /* undo sequence */
    }
  }, []);

  const keyMap = useMemo(() => ({
    "Ctrl-Enter": (e) => {/* ... */}
  }), []);

  return (
    <CodeReplay
      className={"code-replay"}
      command={replayCommand}
      keyMap={keyMap}
      mode={"javascript"}
      ref={codeReplay}
      replay={codeRecording}
      start={0}
      theme="default"
    />
  );
}
```
